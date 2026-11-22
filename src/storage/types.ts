import type { Difficulty, Puzzle } from '../core/puzzle/types.ts';

export const STORAGE_SCHEMA_VERSION = 1;

export interface StoredPuzzleRecord {
  readonly schemaVersion: typeof STORAGE_SCHEMA_VERSION;
  readonly id: string;
  readonly puzzle: Puzzle;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoredProgressRecord {
  readonly schemaVersion: typeof STORAGE_SCHEMA_VERSION;
  readonly id: string;
  readonly progress: Readonly<Record<number, string>>;
  readonly solved: boolean;
  readonly updatedAt: string;
}

export interface SavedPuzzle {
  readonly id: string;
  readonly puzzle: Puzzle;
  readonly progress: Readonly<Record<number, string>>;
  readonly solved: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SavedPuzzleSummary {
  readonly id: string;
  readonly heading: string;
  readonly theme: string;
  readonly difficulty: Difficulty;
  readonly width: number;
  readonly height: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly filled: number;
  readonly total: number;
  readonly solved: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function isStoredPuzzle(value: unknown): value is StoredPuzzleRecord {
  if (!isRecord(value) || value.schemaVersion !== STORAGE_SCHEMA_VERSION) return false;
  if (typeof value.id !== 'string' || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false;
  const puzzle = value.puzzle;
  if (!isRecord(puzzle) || puzzle.schemaVersion !== 1) return false;
  if (!isRecord(puzzle.meta) || puzzle.meta.id !== value.id) return false;
  if (!isRecord(puzzle.editorial) || !isRecord(puzzle.grid) || !Array.isArray(puzzle.grid.cells)) return false;
  return Array.isArray(puzzle.cipher) && Array.isArray(puzzle.words) && Array.isArray(puzzle.answerParts) && Array.isArray(puzzle.givens);
}

export function isStoredProgress(value: unknown): value is StoredProgressRecord {
  return (
    isRecord(value) &&
    value.schemaVersion === STORAGE_SCHEMA_VERSION &&
    typeof value.id === 'string' &&
    isRecord(value.progress) &&
    Object.values(value.progress).every((letter) => typeof letter === 'string') &&
    typeof value.solved === 'boolean' &&
    typeof value.updatedAt === 'string'
  );
}

export function joinRecords(puzzle: StoredPuzzleRecord, progress: StoredProgressRecord | null): SavedPuzzle {
  return {
    id: puzzle.id,
    puzzle: puzzle.puzzle,
    progress: progress?.progress ?? {},
    solved: progress?.solved ?? false,
    createdAt: puzzle.createdAt,
    updatedAt: progress && progress.updatedAt > puzzle.updatedAt ? progress.updatedAt : puzzle.updatedAt,
  };
}

export function summarize(record: SavedPuzzle): SavedPuzzleSummary {
  const { puzzle } = record;
  const numbers = new Set(puzzle.cipher.map((e) => e.number));
  return {
    id: record.id,
    heading: puzzle.editorial.heading || puzzle.meta.title || 'Без заголовка',
    theme: puzzle.meta.theme,
    difficulty: puzzle.meta.difficulty,
    width: puzzle.grid.width,
    height: puzzle.grid.height,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    filled: Object.keys(record.progress).filter((key) => numbers.has(Number(key))).length,
    total: numbers.size,
    solved: record.solved,
  };
}
