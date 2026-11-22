import type { Alphabet } from '../alphabet.ts';
import { normalizeAnswer } from '../alphabet.ts';
import { cipherPuzzle } from '../cipher/assign.ts';
import type { Dictionary } from '../dictionary/dictionary.ts';
import type { GridConfig } from '../fill/generateGrid.ts';
import { DEFAULT_GRID_CONFIG, generateGrid } from '../fill/generateGrid.ts';
import { createRng } from '../rng.ts';
import type { Difficulty, Puzzle } from './types.ts';

export interface DifficultyProfile {
  readonly minIpm: number;
  readonly starterLengths: readonly [number, number];
}

export const DIFFICULTY_PROFILES: Readonly<Record<Difficulty, DifficultyProfile>> = {
  easy: { minIpm: 10, starterLengths: [5, 7] },
  medium: { minIpm: 2, starterLengths: [4, 6] },
  hard: { minIpm: 0.5, starterLengths: [3, 5] },
};

export interface PuzzleRequest {
  readonly id: string;
  readonly title: string;
  readonly theme: string;
  readonly difficulty: Difficulty;
  readonly seed: number;
  readonly createdAt: string;
  readonly editorial: Puzzle['editorial'];
  readonly illustration: Puzzle['illustration'];
  readonly grid?: Partial<Omit<GridConfig, 'answerParts' | 'seed'>>;
}

export interface GenerateOptions {
  readonly dictionary: Dictionary;
  readonly alphabet: Alphabet;
  readonly maxGridAttempts?: number;
  readonly maxStarterTries?: number;
  readonly solverBudget?: number;
  readonly minNumberOccurrences?: number;
}

export type GenerateResult =
  | { readonly status: 'ok'; readonly puzzle: Puzzle; readonly gridAttempts: number }
  | { readonly status: 'failed'; readonly reason: string; readonly gridAttempts: number };

export function generatePuzzle(request: PuzzleRequest, options: GenerateOptions): GenerateResult {
  const answerParts = normalizeAnswer(request.editorial.answer, options.alphabet);
  if (!answerParts) {
    return { status: 'failed', reason: 'Ответ пустой или содержит недопустимые символы', gridAttempts: 0 };
  }

  const profile = DIFFICULTY_PROFILES[request.difficulty];
  const fillDictionary = options.dictionary.filter({ minIpm: profile.minIpm });
  const rng = createRng(request.seed);
  const maxGridAttempts = options.maxGridAttempts ?? 10;
  const reasons: string[] = [];

  for (let attempt = 1; attempt <= maxGridAttempts; attempt += 1) {
    const gridSeed = rng.fork(attempt).int(2 ** 31);
    const grid = generateGrid({ ...DEFAULT_GRID_CONFIG, ...request.grid, answerParts, seed: gridSeed }, fillDictionary);
    if (grid.status === 'failed') {
      reasons.push(grid.reason);
      if (attempt === 1 && grid.stats.nodes === 0) break;
      continue;
    }

    const result = cipherPuzzle({
      grid: grid.grid,
      words: grid.words,
      answer: grid.answer,
      meta: {
        id: request.id,
        title: request.title,
        theme: request.theme,
        difficulty: request.difficulty,
        language: 'ru',
        alphabet: options.alphabet.id,
        seed: request.seed,
        createdAt: request.createdAt,
      },
      editorial: request.editorial,
      illustration: request.illustration,
      dictionary: options.dictionary,
      alphabet: options.alphabet,
      rng: rng.fork(1000 + attempt),
      starterLengths: profile.starterLengths,
      maxStarterTries: options.maxStarterTries ?? 6,
      solverBudget: options.solverBudget ?? 200_000,
      minNumberOccurrences: options.minNumberOccurrences ?? 1,
    });
    if (result.status === 'ok') return { status: 'ok', puzzle: result.puzzle, gridAttempts: attempt };
    reasons.push(result.reason);
  }

  return {
    status: 'failed',
    reason: `Головоломка не прошла проверку: ${[...new Set(reasons)].join('; ')}`,
    gridAttempts: maxGridAttempts,
  };
}
