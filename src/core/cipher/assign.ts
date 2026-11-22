import type { Alphabet } from '../alphabet.ts';
import type { Dictionary } from '../dictionary/dictionary.ts';
import type { LetterGrid } from '../grid/rows.ts';
import type { AnswerPlacement } from '../fill/layout.ts';
import { assemblePuzzle } from '../puzzle/assemble.ts';
import type { PlacedWord, Puzzle } from '../puzzle/types.ts';
import { toCipherInput, toPlayView } from '../puzzle/views.ts';
import type { Rng } from '../rng.ts';
import { solveCipher } from '../solver/uniqueness.ts';
import type { UniquenessVerdict } from '../validate/validatePuzzle.ts';
import { validatePuzzle } from '../validate/validatePuzzle.ts';

export interface CipherInput {
  readonly grid: LetterGrid;
  readonly words: readonly PlacedWord[];
  readonly answer: readonly AnswerPlacement[];
  readonly meta: Puzzle['meta'];
  readonly editorial: Puzzle['editorial'];
  readonly illustration: Puzzle['illustration'];
  readonly dictionary: Dictionary;
  readonly alphabet: Alphabet;
  readonly rng: Rng;
  readonly starterLengths: readonly [number, number];
  readonly maxStarterTries: number;
  readonly solverBudget: number;
  readonly minNumberOccurrences: number;
}

export type CipherResult =
  | { readonly status: 'ok'; readonly puzzle: Puzzle; readonly starterTries: number }
  | { readonly status: 'failed'; readonly reason: string; readonly verdicts: readonly UniquenessVerdict[] };

export function letterCounts(grid: LetterGrid): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of grid.letters) if (letter) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  return counts;
}

export function cipherPuzzle(input: CipherInput): CipherResult {
  const { grid, rng } = input;
  const counts = letterCounts(grid);
  const rare = [...counts.entries()].filter(([, n]) => n < input.minNumberOccurrences).map(([l]) => l);
  if (rare.length > 0) {
    return { status: 'failed', reason: `Буквы встречаются слишком редко: ${rare.join(', ')}`, verdicts: [] };
  }

  const answerKeys = new Set(input.answer.map((a) => `${a.row}:${a.col}:${a.dir}:${a.text.length}`));
  const [minStarter, maxStarter] = input.starterLengths;
  const starters = rng
    .shuffle(
      input.words.filter(
        (w) =>
          !answerKeys.has(`${w.row}:${w.col}:${w.dir}:${w.word.length}`) &&
          w.word.length >= minStarter &&
          w.word.length <= maxStarter,
      ),
    )
    .sort((a, b) => new Set(b.word).size - new Set(a.word).size)
    .slice(0, input.maxStarterTries);

  if (starters.length === 0) return { status: 'failed', reason: 'Нет подходящего стартового слова', verdicts: [] };

  const allLetters = [...counts.keys()];
  const verdicts: UniquenessVerdict[] = [];
  for (const [i, starter] of starters.entries()) {
    const starterLetters = [...new Set(starter.word)];
    const rest = rng.shuffle(allLetters.filter((l) => !starterLetters.includes(l)));
    const puzzle = assemblePuzzle({
      grid,
      words: input.words,
      answerParts: input.answer,
      letterOrder: [...starterLetters, ...rest],
      starter,
      meta: input.meta,
      editorial: input.editorial,
      illustration: input.illustration,
    });

    const solved = solveCipher(toCipherInput(toPlayView(puzzle)), {
      dictionary: input.dictionary,
      alphabet: input.alphabet,
      nodeBudget: input.solverBudget,
    });
    verdicts.push(solved.verdict);
    if (solved.verdict !== 'unique') continue;
    const mismatch = puzzle.cipher.find((e) => solved.solution?.[e.number] !== e.letter);
    if (mismatch) {
      return {
        status: 'failed',
        reason: `Решатель нашёл расшифровку, отличную от шифра (номер ${mismatch.number})`,
        verdicts,
      };
    }

    const report = validatePuzzle(puzzle, {
      dictionary: input.dictionary,
      alphabet: input.alphabet,
      minNumberOccurrences: input.minNumberOccurrences,
      checkUniqueness: () => solved.verdict,
    });
    if (!report.valid) {
      return {
        status: 'failed',
        reason: `Валидация не пройдена: ${report.issues.map((issue) => issue.message).join('; ')}`,
        verdicts,
      };
    }
    return { status: 'ok', puzzle: { ...puzzle, validation: report }, starterTries: i + 1 };
  }

  return { status: 'failed', reason: `Ни одно из ${starters.length} стартовых слов не дало единственного решения`, verdicts };
}
