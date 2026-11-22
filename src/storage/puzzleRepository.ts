import type { Puzzle } from '../core/puzzle/types.ts';
import type { ExportItem } from './exchange.ts';
import type { SavedPuzzle, SavedPuzzleSummary, StoredProgressRecord, StoredPuzzleRecord } from './types.ts';
import { STORAGE_SCHEMA_VERSION, isStoredProgress, isStoredPuzzle, joinRecords, summarize } from './types.ts';

const PUZZLES = 'puzzles';
const PROGRESS = 'progress';
const DB_VERSION = 1;

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.addEventListener('success', () => resolve(req.result));
    req.addEventListener('error', () => reject(req.error ?? new Error('Ошибка IndexedDB')));
  });

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.addEventListener('complete', () => resolve());
    tx.addEventListener('error', () => reject(tx.error ?? new Error('Ошибка транзакции IndexedDB')));
    tx.addEventListener('abort', () => reject(tx.error ?? new Error('Транзакция IndexedDB прервана')));
  });

export interface RepositoryOptions {
  readonly dbName?: string;
  readonly factory?: IDBFactory;
  readonly now?: () => Date;
}

export class PuzzleRepository {
  private readonly dbName: string;
  private readonly factory: IDBFactory | undefined;
  private readonly now: () => Date;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(options: RepositoryOptions = {}) {
    this.dbName = options.dbName ?? 'keywords';
    this.factory = options.factory ?? (typeof indexedDB === 'undefined' ? undefined : indexedDB);
    this.now = options.now ?? (() => new Date());
  }

  private open(): Promise<IDBDatabase> {
    const factory = this.factory;
    if (!factory) return Promise.reject(new Error('IndexedDB недоступен в этом браузере'));
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(this.dbName, DB_VERSION);
      req.addEventListener('upgradeneeded', () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PUZZLES)) db.createObjectStore(PUZZLES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(PROGRESS)) db.createObjectStore(PROGRESS, { keyPath: 'id' });
      });
      req.addEventListener('success', () => resolve(req.result));
      req.addEventListener('error', () => reject(req.error ?? new Error('Не удалось открыть IndexedDB')));
      req.addEventListener('blocked', () => reject(new Error('IndexedDB заблокирован другой вкладкой')));
    }).catch((error: unknown) => {
      this.dbPromise = null;
      throw error;
    });
    return this.dbPromise;
  }

  async save(puzzle: Puzzle): Promise<SavedPuzzle> {
    const db = await this.open();
    const timestamp = this.now().toISOString();
    const tx = db.transaction([PUZZLES, PROGRESS], 'readwrite');
    const existing: unknown = await request(tx.objectStore(PUZZLES).get(puzzle.meta.id));
    const progress: unknown = await request(tx.objectStore(PROGRESS).get(puzzle.meta.id));
    const record: StoredPuzzleRecord = {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      id: puzzle.meta.id,
      puzzle,
      createdAt: isStoredPuzzle(existing) ? existing.createdAt : timestamp,
      updatedAt: timestamp,
    };
    tx.objectStore(PUZZLES).put(record);
    await done(tx);
    return joinRecords(record, isStoredProgress(progress) ? progress : null);
  }

  async saveProgress(id: string, progress: Readonly<Record<number, string>>, solved: boolean): Promise<boolean> {
    const db = await this.open();
    const tx = db.transaction([PUZZLES, PROGRESS], 'readwrite');
    const key: unknown = await request(tx.objectStore(PUZZLES).getKey(id));
    if (key === undefined) {
      tx.abort();
      return false;
    }
    const record: StoredProgressRecord = {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      id,
      progress: { ...progress },
      solved,
      updatedAt: this.now().toISOString(),
    };
    tx.objectStore(PROGRESS).put(record);
    await done(tx);
    return true;
  }

  async get(id: string): Promise<SavedPuzzle | null> {
    const db = await this.open();
    const tx = db.transaction([PUZZLES, PROGRESS], 'readonly');
    const [puzzle, progress] = await Promise.all([
      request<unknown>(tx.objectStore(PUZZLES).get(id)),
      request<unknown>(tx.objectStore(PROGRESS).get(id)),
    ]);
    if (!isStoredPuzzle(puzzle)) return null;
    return joinRecords(puzzle, isStoredProgress(progress) ? progress : null);
  }

  async list(): Promise<SavedPuzzleSummary[]> {
    const db = await this.open();
    const tx = db.transaction([PUZZLES, PROGRESS], 'readonly');
    const [puzzles, progress] = await Promise.all([
      request<unknown[]>(tx.objectStore(PUZZLES).getAll()),
      request<unknown[]>(tx.objectStore(PROGRESS).getAll()),
    ]);
    const progressById = new Map(progress.filter(isStoredProgress).map((p) => [p.id, p]));
    return puzzles
      .filter(isStoredPuzzle)
      .map((p) => summarize(joinRecords(p, progressById.get(p.id) ?? null)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listRecords(): Promise<SavedPuzzle[]> {
    const db = await this.open();
    const tx = db.transaction([PUZZLES, PROGRESS], 'readonly');
    const [puzzles, progress] = await Promise.all([
      request<unknown[]>(tx.objectStore(PUZZLES).getAll()),
      request<unknown[]>(tx.objectStore(PROGRESS).getAll()),
    ]);
    const progressById = new Map(progress.filter(isStoredProgress).map((p) => [p.id, p]));
    return puzzles
      .filter(isStoredPuzzle)
      .map((p) => joinRecords(p, progressById.get(p.id) ?? null))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async importItem(item: ExportItem): Promise<'added' | 'exists'> {
    const db = await this.open();
    const id = item.puzzle.meta.id;
    const tx = db.transaction([PUZZLES, PROGRESS], 'readwrite');
    const key: unknown = await request(tx.objectStore(PUZZLES).getKey(id));
    if (key !== undefined) {
      tx.abort();
      return 'exists';
    }
    const timestamp = this.now().toISOString();
    const record: StoredPuzzleRecord = {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      id,
      puzzle: item.puzzle,
      createdAt: item.createdAt,
      updatedAt: timestamp,
    };
    tx.objectStore(PUZZLES).put(record);
    if (item.solved || Object.keys(item.progress).length > 0) {
      const progress: StoredProgressRecord = {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        id,
        progress: { ...item.progress },
        solved: item.solved,
        updatedAt: timestamp,
      };
      tx.objectStore(PROGRESS).put(progress);
    }
    await done(tx);
    return 'added';
  }

  async delete(id: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([PUZZLES, PROGRESS], 'readwrite');
    tx.objectStore(PUZZLES).delete(id);
    tx.objectStore(PROGRESS).delete(id);
    await done(tx);
  }

  close(): void {
    void this.dbPromise?.then((db) => db.close()).catch(() => undefined);
    this.dbPromise = null;
  }
}
