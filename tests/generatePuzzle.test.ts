import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../src/core/alphabet.ts';
import { dictionaryFromFile } from '../src/core/dictionary/loader.ts';
import type { PuzzleRequest } from '../src/core/puzzle/generatePuzzle.ts';
import { generatePuzzle } from '../src/core/puzzle/generatePuzzle.ts';
import type { Difficulty } from '../src/core/puzzle/types.ts';
import { toPlayView } from '../src/core/puzzle/views.ts';
import { validatePuzzle } from '../src/core/validate/validatePuzzle.ts';

const dictionary = dictionaryFromFile(
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../public/dict/ru-nouns.v1.json'), 'utf8')),
  RU_ALPHABET,
);

const request = (seed: number, difficulty: Difficulty, answer: string): PuzzleRequest => ({
  id: `p-${seed}`,
  title: 'Тест',
  theme: 'тест',
  difficulty,
  seed,
  createdAt: '2026-11-22T00:00:00.000Z',
  editorial: { rubric: 'Лучше не скажешь!', heading: 'Заголовок', riddle: 'Загадка', explanation: 'Пояснение', answer },
  illustration: { src: '/illustrations/placeholder.png', alt: '', prompt: '', placeholder: true },
});

const options = { dictionary, alphabet: RU_ALPHABET };
const ANSWERS = ['зеркало', 'тихий омут', 'Самовар'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

describe('generatePuzzle — приёмка этапа 4', () => {
  it('строит 30 полностью валидных головоломок с единственным решением', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const difficulty = DIFFICULTIES[seed % 3] as Difficulty;
      const answer = ANSWERS[seed % ANSWERS.length] as string;
      const result = generatePuzzle(request(seed, difficulty, answer), options);
      expect(result.status, `seed ${seed}: ${result.status === 'failed' ? result.reason : ''}`).toBe('ok');
      if (result.status !== 'ok') continue;

      const { puzzle } = result;
      expect(puzzle.validation?.valid, `seed ${seed}`).toBe(true);
      expect(puzzle.validation?.checks.every((c) => c.status === 'passed')).toBe(true);
      expect(puzzle.givens.length).toBeGreaterThan(0);
      expect(puzzle.givens).toEqual(Array.from({ length: puzzle.givens.length }, (_, i) => i + 1));

      const recheck = validatePuzzle(puzzle, { dictionary, alphabet: RU_ALPHABET, checkUniqueness: () => 'unique' });
      expect(recheck.valid).toBe(true);
    }
  }, 120_000);

  it('игровая версия не раскрывает решение', () => {
    const result = generatePuzzle(request(7, 'medium', 'тихий омут'), options);
    if (result.status !== 'ok') throw new Error(result.reason);
    const { puzzle } = result;
    const view = toPlayView(puzzle);
    const json = JSON.stringify(view);

    expect(json).not.toContain('ТИХИЙ');
    expect(json).not.toContain('ОМУТ');
    expect(view.editorial).not.toHaveProperty('answer');
    expect(view).not.toHaveProperty('cipher');
    expect(view).not.toHaveProperty('words');

    const givenNumbers = new Set(puzzle.givens);
    for (const cell of view.grid.cells) {
      if (cell.kind !== 'letter') continue;
      if (cell.given !== undefined) expect(givenNumbers.has(cell.number)).toBe(true);
    }
    expect(view.key.filter((k) => k.letter !== null).map((k) => k.number)).toEqual(puzzle.givens);
    const openCells = view.grid.cells.filter((c) => c.kind === 'letter' && c.given !== undefined).length;
    const starterCells = puzzle.grid.cells.filter((c) => c.kind === 'letter' && c.given).length;
    expect(openCells).toBe(starterCells);
  });

  it('детерминирован по seed', () => {
    const a = generatePuzzle(request(11, 'easy', 'зеркало'), options);
    const b = generatePuzzle(request(11, 'easy', 'зеркало'), options);
    expect(a).toEqual(b);
  });

  it('отклоняет недопустимый ответ', () => {
    expect(generatePuzzle(request(1, 'easy', 'mirror'), options).status).toBe('failed');
    expect(generatePuzzle(request(1, 'easy', 'в храм'), options).status).toBe('failed');
  });
});
