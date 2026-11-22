import type { Puzzle } from '../core/puzzle/types.ts';
import { puzzleShapeError } from './puzzleShape.ts';
import type { SavedPuzzle } from './types.ts';

export const EXPORT_FORMAT = 'keywords-export';
export const EXPORT_VERSION = 1;

export interface ExportItem {
  readonly puzzle: Puzzle;
  readonly progress: Readonly<Record<number, string>>;
  readonly solved: boolean;
  readonly createdAt: string;
}

export interface ExportFile {
  readonly format: typeof EXPORT_FORMAT;
  readonly version: typeof EXPORT_VERSION;
  readonly exportedAt: string;
  readonly items: readonly ExportItem[];
}

export interface RejectedItem {
  readonly label: string;
  readonly reason: string;
}

export interface ParsedExport {
  readonly items: readonly ExportItem[];
  readonly rejected: readonly RejectedItem[];
}

export class ExchangeError extends Error {}

function withoutValidation(puzzle: Puzzle): Puzzle {
  const copy: { -readonly [K in keyof Puzzle]?: Puzzle[K] } = { ...puzzle };
  delete copy.validation;
  return copy as Puzzle;
}

export function createExport(records: readonly SavedPuzzle[], now: Date): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    items: records.map((record) => {
      return { puzzle: withoutValidation(record.puzzle), progress: record.progress, solved: record.solved, createdAt: record.createdAt };
    }),
  };
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file, null, 2);
}

const slug = (text: string) =>
  text
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export function exportFileName(records: readonly SavedPuzzle[], now: Date): string {
  const date = now.toISOString().slice(0, 10);
  const single = records.length === 1 ? records[0] : undefined;
  const name = single ? slug(single.puzzle.editorial.heading || single.puzzle.meta.title) : '';
  return name ? `keywords-${name}-${date}.json` : `keywords-${date}.json`;
}

const isObj = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function itemLabel(raw: unknown, index: number): string {
  const heading = isObj(raw) && isObj(raw.puzzle) && isObj(raw.puzzle.editorial) ? raw.puzzle.editorial.heading : null;
  return typeof heading === 'string' && heading ? `№${index + 1} «${heading}»` : `№${index + 1}`;
}

function cleanProgress(raw: unknown, puzzle: Puzzle): Record<number, string> {
  if (!isObj(raw)) return {};
  const numbers = new Set(puzzle.cipher.map((entry) => entry.number));
  const progress: Record<number, string> = {};
  for (const [key, letter] of Object.entries(raw)) {
    const number = Number(key);
    if (numbers.has(number) && typeof letter === 'string' && letter.length === 1) progress[number] = letter;
  }
  return progress;
}

export function parseExport(text: string, alphabetId: string): ParsedExport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ExchangeError('Файл не является корректным JSON');
  }
  if (!isObj(data) || data.format !== EXPORT_FORMAT) {
    throw new ExchangeError('Это не файл экспорта кейвордов');
  }
  if (data.version !== EXPORT_VERSION) {
    throw new ExchangeError(`Неподдерживаемая версия файла: ${String(data.version)}`);
  }
  if (!Array.isArray(data.items)) throw new ExchangeError('В файле нет списка головоломок');

  const items: ExportItem[] = [];
  const rejected: RejectedItem[] = [];
  const seen = new Set<string>();
  data.items.forEach((raw: unknown, index) => {
    const label = itemLabel(raw, index);
    if (!isObj(raw)) {
      rejected.push({ label, reason: 'запись не объект' });
      return;
    }
    const shapeError = puzzleShapeError(raw.puzzle);
    if (shapeError) {
      rejected.push({ label, reason: shapeError });
      return;
    }
    const puzzle = withoutValidation(raw.puzzle as Puzzle);
    if (puzzle.meta.alphabet !== alphabetId) {
      rejected.push({ label, reason: `алфавит ${puzzle.meta.alphabet} не поддерживается` });
      return;
    }
    if (seen.has(puzzle.meta.id)) {
      rejected.push({ label, reason: 'повтор id внутри файла' });
      return;
    }
    seen.add(puzzle.meta.id);
    items.push({
      puzzle,
      progress: cleanProgress(raw.progress, puzzle),
      solved: raw.solved === true,
      createdAt: typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : puzzle.meta.createdAt,
    });
  });
  return { items, rejected };
}
