import type { Puzzle } from '../core/puzzle/types.ts';

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStr = (value: unknown): value is string => typeof value === 'string';
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const isDir = (value: unknown) => value === 'across' || value === 'down';
const isDifficulty = (value: unknown) => value === 'easy' || value === 'medium' || value === 'hard';

function cellError(cell: unknown): string | null {
  if (!isObj(cell)) return 'клетка не объект';
  if (cell.kind === 'void' || cell.kind === 'block') return null;
  if (cell.kind !== 'letter') return `неизвестный тип клетки «${String(cell.kind)}»`;
  if (!isStr(cell.letter) || cell.letter.length !== 1) return 'у буквенной клетки нет буквы';
  if (!isInt(cell.number) || cell.number < 1) return 'у буквенной клетки нет номера';
  if (typeof cell.given !== 'boolean') return 'у буквенной клетки нет признака подсказки';
  if (cell.answerPart !== undefined && !isInt(cell.answerPart)) return 'неверный номер части ответа';
  return null;
}

export function puzzleShapeError(value: unknown): string | null {
  if (!isObj(value)) return 'головоломка не объект';
  if (value.schemaVersion !== 1) return `неподдерживаемая версия схемы головоломки «${String(value.schemaVersion)}»`;

  const meta = value.meta;
  if (!isObj(meta)) return 'нет метаданных';
  for (const key of ['id', 'title', 'theme', 'alphabet', 'createdAt'] as const) {
    if (!isStr(meta[key])) return `в метаданных нет поля «${key}»`;
  }
  if (!(meta.id as string)) return 'пустой id';
  if (!isDifficulty(meta.difficulty)) return 'неизвестная сложность';
  if (meta.language !== 'ru') return 'неподдерживаемый язык';
  if (!isInt(meta.seed)) return 'неверный seed';

  const editorial = value.editorial;
  if (!isObj(editorial)) return 'нет редакционного текста';
  for (const key of ['rubric', 'heading', 'riddle', 'explanation', 'answer'] as const) {
    if (!isStr(editorial[key])) return `в тексте нет поля «${key}»`;
  }

  const illustration = value.illustration;
  if (!isObj(illustration)) return 'нет описания иллюстрации';
  for (const key of ['src', 'alt', 'prompt'] as const) {
    if (!isStr(illustration[key])) return `в иллюстрации нет поля «${key}»`;
  }
  if (typeof illustration.placeholder !== 'boolean') return 'в иллюстрации нет признака шаблона';

  const grid = value.grid;
  if (!isObj(grid) || !isInt(grid.width) || !isInt(grid.height) || !Array.isArray(grid.cells)) return 'неверная сетка';
  if (grid.width < 1 || grid.height < 1 || grid.width > 60 || grid.height > 60) return 'недопустимый размер сетки';
  for (const cell of grid.cells) {
    const error = cellError(cell);
    if (error) return error;
  }

  if (!Array.isArray(value.words)) return 'нет списка слов';
  for (const word of value.words) {
    if (!isObj(word) || !isStr(word.word) || !isInt(word.row) || !isInt(word.col) || !isDir(word.dir)) {
      return 'неверная запись в списке слов';
    }
  }

  if (!Array.isArray(value.answerParts)) return 'нет частей ответа';
  for (const part of value.answerParts) {
    if (!isObj(part) || !isInt(part.order) || !isStr(part.text) || !isInt(part.row) || !isInt(part.col) || !isDir(part.dir)) {
      return 'неверная часть ответа';
    }
  }

  if (!Array.isArray(value.cipher)) return 'нет таблицы шифра';
  for (const entry of value.cipher) {
    if (!isObj(entry) || !isInt(entry.number) || !isStr(entry.letter)) return 'неверная запись шифра';
  }

  if (!Array.isArray(value.givens) || !value.givens.every(isInt)) return 'неверный список подсказок';
  return null;
}

export function isPuzzleShape(value: unknown): value is Puzzle {
  return puzzleShapeError(value) === null;
}
