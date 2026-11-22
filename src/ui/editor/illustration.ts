import type { Puzzle } from '../../core/puzzle/types.ts';

export type Illustration = Puzzle['illustration'];

export function replaceIllustration(puzzle: Puzzle, patch: Partial<Illustration>): Puzzle {
  return { ...puzzle, illustration: { ...puzzle.illustration, ...patch } };
}
