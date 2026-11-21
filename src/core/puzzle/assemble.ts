import type { LetterGrid } from '../grid/rows.ts';
import { slotCells } from '../grid/slots.ts';
import type { AnswerPart, CipherEntry, PlacedWord, Puzzle, PuzzleCell } from './types.ts';

export interface AssembleInput {
  readonly grid: LetterGrid;
  readonly words: readonly PlacedWord[];
  readonly answerParts: readonly Omit<AnswerPart, 'order'>[];
  readonly letterOrder: readonly string[];
  readonly starter?: PlacedWord;
  readonly meta: Puzzle['meta'];
  readonly editorial: Puzzle['editorial'];
  readonly illustration: Puzzle['illustration'];
}

export function assemblePuzzle(input: AssembleInput): Puzzle {
  const { grid } = input;
  const numberOf = new Map(input.letterOrder.map((letter, i) => [letter, i + 1]));
  if (numberOf.size !== input.letterOrder.length) throw new Error('В порядке букв есть повторы');

  const answerFlags = new Map<number, number>();
  const answerParts: AnswerPart[] = input.answerParts.map((part, i) => {
    slotCells(grid, part.row, part.col, part.dir, part.text.length).forEach((index) => answerFlags.set(index, i + 1));
    return { ...part, order: i + 1 };
  });

  const starterCells = new Set(
    input.starter ? slotCells(grid, input.starter.row, input.starter.col, input.starter.dir, input.starter.word.length) : [],
  );

  const usedNumbers = new Set<number>();
  const cells: PuzzleCell[] = grid.kinds.map((kind, index) => {
    if (kind !== 'letter') return { kind };
    const letter = grid.letters[index];
    if (!letter) throw new Error(`Клетка ${index} не заполнена`);
    const number = numberOf.get(letter);
    if (number === undefined) throw new Error(`Буквы «${letter}» нет в порядке нумерации`);
    usedNumbers.add(number);
    const answerPart = answerFlags.get(index);
    return {
      kind: 'letter',
      letter,
      number,
      given: starterCells.has(index),
      ...(answerPart === undefined ? {} : { answerPart }),
    };
  });

  const cipher: CipherEntry[] = input.letterOrder
    .map((letter, i) => ({ number: i + 1, letter }))
    .filter((entry) => usedNumbers.has(entry.number));

  const givens = input.starter
    ? [...new Set([...input.starter.word].map((letter) => numberOf.get(letter) as number))].sort((a, b) => a - b)
    : [];

  return {
    schemaVersion: 1,
    meta: input.meta,
    editorial: input.editorial,
    illustration: input.illustration,
    grid: { width: grid.width, height: grid.height, cells },
    words: input.words,
    answerParts,
    cipher,
    givens,
  };
}
