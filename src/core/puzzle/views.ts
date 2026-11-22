import type { Direction } from '../grid/types.ts';
import type { CipherGridInput } from '../solver/uniqueness.ts';
import type { Puzzle } from './types.ts';

export type PlayCell =
  | { readonly kind: 'void' }
  | { readonly kind: 'block' }
  | { readonly kind: 'letter'; readonly number: number; readonly given?: string; readonly answerPart?: number };

export interface AnswerMarker {
  readonly order: number;
  readonly row: number;
  readonly col: number;
  readonly dir: Direction;
  readonly length: number;
}

export interface KeyEntry {
  readonly number: number;
  readonly letter: string | null;
}

export interface PlayView {
  readonly meta: Pick<Puzzle['meta'], 'id' | 'title' | 'theme' | 'difficulty' | 'language' | 'alphabet'>;
  readonly editorial: Omit<Puzzle['editorial'], 'answer'>;
  readonly illustration: Puzzle['illustration'];
  readonly grid: { readonly width: number; readonly height: number; readonly cells: readonly PlayCell[] };
  readonly key: readonly KeyEntry[];
  readonly answerMarkers: readonly AnswerMarker[];
}

export function toPlayView(puzzle: Puzzle): PlayView {
  const givens = new Set(puzzle.givens);
  const givenLetter = new Map(puzzle.cipher.filter((e) => givens.has(e.number)).map((e) => [e.number, e.letter]));
  const { id, title, theme, difficulty, language, alphabet } = puzzle.meta;
  const { rubric, heading, riddle, explanation } = puzzle.editorial;

  const cells: PlayCell[] = puzzle.grid.cells.map((cell) => {
    if (cell.kind !== 'letter') return { kind: cell.kind };
    const given = cell.given ? givenLetter.get(cell.number) : undefined;
    return {
      kind: 'letter',
      number: cell.number,
      ...(given === undefined ? {} : { given }),
      ...(cell.answerPart === undefined ? {} : { answerPart: cell.answerPart }),
    };
  });

  return {
    meta: { id, title, theme, difficulty, language, alphabet },
    editorial: { rubric, heading, riddle, explanation },
    illustration: puzzle.illustration,
    grid: { width: puzzle.grid.width, height: puzzle.grid.height, cells },
    key: puzzle.cipher.map((e) => ({ number: e.number, letter: givenLetter.get(e.number) ?? null })),
    answerMarkers: puzzle.answerParts.map((p) => ({ order: p.order, row: p.row, col: p.col, dir: p.dir, length: p.text.length })),
  };
}

export function toCipherInput(view: PlayView): CipherGridInput {
  return {
    width: view.grid.width,
    height: view.grid.height,
    numbers: view.grid.cells.map((cell) => (cell.kind === 'letter' ? cell.number : null)),
    givens: Object.fromEntries(view.key.filter((k) => k.letter !== null).map((k) => [k.number, k.letter as string])),
    exemptSlots: view.answerMarkers.map((m) => ({ row: m.row, col: m.col, dir: m.dir, length: m.length })),
  };
}
