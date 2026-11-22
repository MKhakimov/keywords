import type { Alphabet } from '../alphabet.ts';
import type { Dictionary } from '../dictionary/dictionary.ts';
import { solveCipher } from '../solver/uniqueness.ts';
import type { ValidationReport } from '../validate/report.ts';
import { validatePuzzle } from '../validate/validatePuzzle.ts';
import type { Puzzle } from './types.ts';
import { toCipherInput, toPlayView } from './views.ts';

export interface VerifyOptions {
  readonly dictionary: Dictionary;
  readonly alphabet: Alphabet;
  readonly solverBudget?: number;
}

export function verifyPuzzle(puzzle: Puzzle, options: VerifyOptions): ValidationReport {
  return validatePuzzle(puzzle, {
    dictionary: options.dictionary,
    alphabet: options.alphabet,
    checkUniqueness: (checked) =>
      solveCipher(toCipherInput(toPlayView(checked)), {
        dictionary: options.dictionary,
        alphabet: options.alphabet,
        nodeBudget: options.solverBudget ?? 200_000,
      }).verdict,
  });
}
