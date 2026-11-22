import type { Puzzle } from '../../core/puzzle/types.ts';
import type { CheckResult } from './gameState.ts';

export function checkSolution(puzzle: Puzzle, entries: Readonly<Record<number, string>>): CheckResult {
  const wrong: number[] = [];
  let missing = 0;
  for (const { number, letter } of puzzle.cipher) {
    const entry = entries[number];
    if (entry === undefined) missing += 1;
    else if (entry !== letter) wrong.push(number);
  }
  return { wrong, missing, solved: wrong.length === 0 && missing === 0 };
}
