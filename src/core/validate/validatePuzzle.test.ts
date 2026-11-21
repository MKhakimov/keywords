import { describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../alphabet.ts';
import { Dictionary } from '../dictionary/dictionary.ts';
import { parseRows } from '../grid/rows.ts';
import { extractSlots } from '../grid/slots.ts';
import { assemblePuzzle } from '../puzzle/assemble.ts';
import type { LetterCell, PlacedWord, Puzzle, PuzzleCell } from '../puzzle/types.ts';
import type { CheckId } from './report.ts';
import { validatePuzzle } from './validatePuzzle.ts';

const dictionary = new Dictionary(
  ['ДОМ', 'ДУБ', 'БАР', 'ДАР', 'ДОМА'].map((word) => ({ word, ipm: 1 })),
  RU_ALPHABET,
);

const ROWS = ['ДОМ.', 'У#И.', 'БАР.'];

function buildPuzzle(rows = ROWS, answer = 'мир'): Puzzle {
  const grid = parseRows(rows);
  const words: PlacedWord[] = extractSlots(grid, (i) => grid.kinds[i] === 'letter').map((slot) => ({
    word: slot.cells.map((i) => grid.letters[i]).join(''),
    row: slot.row,
    col: slot.col,
    dir: slot.dir,
  }));
  const letters = [...new Set(grid.letters.filter((l): l is string => l !== null))];
  const starter = words.find((w) => w.word === 'ДУБ');
  return assemblePuzzle({
    grid,
    words,
    answerParts: [{ text: 'МИР', row: 0, col: 2, dir: 'down' }],
    letterOrder: letters,
    ...(starter ? { starter } : {}),
    meta: {
      id: 'test',
      title: 'Тест',
      theme: 'тест',
      difficulty: 'easy',
      language: 'ru',
      alphabet: RU_ALPHABET.id,
      seed: 1,
      createdAt: '2026-11-22T00:00:00.000Z',
    },
    editorial: { rubric: '', heading: '', riddle: '', explanation: '', answer },
    illustration: { src: '', alt: '', prompt: '', placeholder: true },
  });
}

const validate = (puzzle: Puzzle, extra: Partial<Parameters<typeof validatePuzzle>[1]> = {}) =>
  validatePuzzle(puzzle, { dictionary, alphabet: RU_ALPHABET, minNumberOccurrences: 1, ...extra });

const failedChecks = (puzzle: Puzzle, extra = {}): CheckId[] =>
  validate(puzzle, extra)
    .checks.filter((c) => c.status === 'failed')
    .map((c) => c.id);

function replaceCell(puzzle: Puzzle, index: number, patch: Partial<LetterCell>): Puzzle {
  const cells: PuzzleCell[] = puzzle.grid.cells.map((cell, i) =>
    i === index && cell.kind === 'letter' ? { ...cell, ...patch } : cell,
  );
  return { ...puzzle, grid: { ...puzzle.grid, cells } };
}

describe('validatePuzzle — корректная головоломка', () => {
  it('проходит все проверки, кроме единственности без решателя', () => {
    const report = validate(buildPuzzle());
    expect(report.issues).toEqual([]);
    expect(report.checks.find((c) => c.id === 'unique-solution')?.status).toBe('skipped');
    expect(report.valid).toBe(false);
  });

  it('валидна целиком, если решатель подтвердил единственность', () => {
    expect(validate(buildPuzzle(), { checkUniqueness: () => 'unique' }).valid).toBe(true);
  });

  it('проваливает проверку, если решение неоднозначно', () => {
    expect(failedChecks(buildPuzzle(), { checkUniqueness: () => 'ambiguous' })).toEqual(['unique-solution']);
  });
});

describe('validatePuzzle — сломанные головоломки', () => {
  it('несогласованные размеры', () => {
    const puzzle = buildPuzzle();
    expect(failedChecks({ ...puzzle, grid: { ...puzzle.grid, width: 5 } })).toEqual(['grid-shape']);
  });

  it('цепочка не из словаря', () => {
    const puzzle = buildPuzzle(['ДОМ.', 'У#И.', 'БОР.']);
    expect(failedChecks(puzzle)).toContain('slots-are-words');
  });

  it('буква вне алфавита', () => {
    expect(failedChecks(replaceCell(buildPuzzle(), 0, { letter: 'Ё' }))).toContain('letters-in-alphabet');
  });

  it('клетка вне слов и разрыв сетки', () => {
    const puzzle = buildPuzzle(['ДОМ.', 'У#И.', 'БАР.', '####', '#Д##']);
    const failed = failedChecks(puzzle);
    expect(failed).toContain('cells-readable');
    expect(failed).toContain('connected');
  });

  it('список слов не совпадает с сеткой', () => {
    const puzzle = buildPuzzle();
    const words = puzzle.words.map((w) => (w.word === 'БАР' ? { ...w, word: 'ДАР' } : w));
    expect(failedChecks({ ...puzzle, words })).toContain('words-match-grid');
  });

  it('слово пропущено или лишнее', () => {
    const puzzle = buildPuzzle();
    expect(failedChecks({ ...puzzle, words: puzzle.words.slice(1) })).toContain('words-cover-slots');
    const extra: PlacedWord = { word: 'ДО', row: 0, col: 0, dir: 'across' };
    expect(failedChecks({ ...puzzle, words: [...puzzle.words, extra] })).toContain('words-cover-slots');
  });

  it('повтор слова', () => {
    const puzzle = buildPuzzle(['ДОМ#ДОМ', 'У#И#У#.', 'БАР#Б..']);
    expect(failedChecks(puzzle)).toContain('no-duplicate-words');
  });

  it('номер клетки расходится с шифром', () => {
    const puzzle = buildPuzzle();
    const first = puzzle.grid.cells[0] as LetterCell;
    expect(failedChecks(replaceCell(puzzle, 0, { number: first.number + 1 }))).toContain('cipher-matches-cells');
  });

  it('один номер у двух букв в шифре', () => {
    const puzzle = buildPuzzle();
    const cipher = puzzle.cipher.map((e, i) => (i === 1 ? { ...e, number: 1 } : e));
    const failed = failedChecks({ ...puzzle, cipher });
    expect(failed).toContain('cipher-bijective');
    expect(failed).toContain('cipher-contiguous');
  });

  it('номер встречается один раз', () => {
    expect(failedChecks(buildPuzzle(), { minNumberOccurrences: 2 })).toEqual(['numbers-repeat']);
  });

  it('ответ не совпадает с сеткой или не размещён', () => {
    expect(failedChecks(buildPuzzle(ROWS, 'мор'))).toContain('answer-present');
    const puzzle = buildPuzzle();
    expect(failedChecks({ ...puzzle, answerParts: [] })).toContain('answer-present');
    expect(failedChecks(replaceCell(puzzle, 2, { answerPart: 2 }))).toContain('answer-present');
  });

  it('стартовые подсказки рассогласованы', () => {
    const puzzle = buildPuzzle();
    expect(failedChecks({ ...puzzle, givens: [...puzzle.givens, 99] })).toContain('givens-valid');
    const openIndex = puzzle.grid.cells.findIndex((c) => c.kind === 'letter' && !c.given && !puzzle.givens.includes(c.number));
    expect(failedChecks(replaceCell(puzzle, openIndex, { given: true }))).toContain('givens-valid');
  });

  it('не запускает решатель, если базовые проверки провалены', () => {
    let called = false;
    const report = validate(buildPuzzle(['ДОМ.', 'У#И.', 'БОР.']), {
      checkUniqueness: () => {
        called = true;
        return 'unique';
      },
    });
    expect(called).toBe(false);
    expect(report.checks.find((c) => c.id === 'unique-solution')?.status).toBe('skipped');
  });
});
