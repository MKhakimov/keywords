import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../src/core/alphabet.ts';
import { dictionaryFromFile } from '../src/core/dictionary/loader.ts';
import { DEFAULT_GRID_CONFIG, generateGrid } from '../src/core/fill/generateGrid.ts';
import { assemblePuzzle } from '../src/core/puzzle/assemble.ts';
import { validatePuzzle } from '../src/core/validate/validatePuzzle.ts';

const dictionary = dictionaryFromFile(
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../public/dict/ru-nouns.v1.json'), 'utf8')),
  RU_ALPHABET,
);

const SEEDS = 100;
const TIME_LIMIT_MS = 3000;

describe('generateGrid — приёмка этапа 3', () => {
  it(`строит ${SEEDS} валидных сеток подряд`, () => {
    const slowest = { seed: 0, ms: 0 };
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const answerParts = seed % 2 === 0 ? ['ЗЕРКАЛО'] : ['ТИХИЙ', 'ОМУТ'];
      const started = performance.now();
      const result = generateGrid({ ...DEFAULT_GRID_CONFIG, answerParts, seed }, dictionary);
      const ms = performance.now() - started;
      if (ms > slowest.ms) Object.assign(slowest, { seed, ms });

      expect(result.status, `seed ${seed}: ${result.status === 'failed' ? result.reason : ''}`).toBe('ok');
      if (result.status !== 'ok') continue;

      const letterOrder = [...new Set(result.grid.letters.filter((l): l is string => l !== null))];
      const puzzle = assemblePuzzle({
        grid: result.grid,
        words: result.words,
        answerParts: result.answer,
        letterOrder,
        meta: {
          id: `seed-${seed}`,
          title: 'Тест',
          theme: 'тест',
          difficulty: 'medium',
          language: 'ru',
          alphabet: RU_ALPHABET.id,
          seed,
          createdAt: '2026-11-22T00:00:00.000Z',
        },
        editorial: { rubric: '', heading: '', riddle: '', explanation: '', answer: answerParts.join(' ') },
        illustration: { src: '', alt: '', prompt: '', placeholder: true },
      });

      const report = validatePuzzle(puzzle, { dictionary, alphabet: RU_ALPHABET, minNumberOccurrences: 1 });
      expect(report.issues, `seed ${seed}`).toEqual([]);
      expect(report.checks.filter((c) => c.status !== 'passed').map((c) => c.id)).toEqual(['unique-solution']);
    }
    expect(slowest.ms, `самый долгий seed ${slowest.seed}`).toBeLessThan(TIME_LIMIT_MS);
  }, 120_000);

  it('детерминирован по seed', () => {
    const config = { ...DEFAULT_GRID_CONFIG, answerParts: ['ЗЕРКАЛО'], seed: 42 };
    const a = generateGrid(config, dictionary);
    const b = generateGrid(config, dictionary);
    expect(a).toEqual(b);
  });

  it('честно сообщает о невозможности, а не возвращает кривую сетку', () => {
    const result = generateGrid({ ...DEFAULT_GRID_CONFIG, answerParts: ['ОЧЕНЬДЛИННЫЙОТВЕТКОТОРЫЙНЕВЛЕЗЕТ'], seed: 1 }, dictionary);
    expect(result.status).toBe('failed');
  });
});
