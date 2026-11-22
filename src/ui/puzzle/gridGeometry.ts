import type { Direction } from '../../core/grid/types.ts';
import type { PlayCell, PlayView } from '../../core/puzzle/views.ts';

export const CELL = 40;

export interface Box {
  readonly row: number;
  readonly col: number;
  readonly width: number;
  readonly height: number;
}

export function voidBox(view: PlayView): Box | null {
  const { width, cells } = view.grid;
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -1;
  let maxCol = -1;
  cells.forEach((cell, i) => {
    if (cell.kind !== 'void') return;
    const r = Math.floor(i / width);
    const c = i % width;
    minRow = Math.min(minRow, r);
    minCol = Math.min(minCol, c);
    maxRow = Math.max(maxRow, r);
    maxCol = Math.max(maxCol, c);
  });
  if (maxRow < 0) return null;
  return { row: minRow, col: minCol, width: maxCol - minCol + 1, height: maxRow - minRow + 1 };
}

export function wordCells(view: PlayView, index: number, direction: Direction): number[] {
  const { width, height, cells } = view.grid;
  const isLetter = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < height && c < width && cells[r * width + c]?.kind === 'letter';
  const [dr, dc] = direction === 'across' ? [0, 1] : [1, 0];
  let r = Math.floor(index / width);
  let c = index % width;
  while (isLetter(r - dr, c - dc)) {
    r -= dr;
    c -= dc;
  }
  const result: number[] = [];
  while (isLetter(r, c)) {
    result.push(r * width + c);
    r += dr;
    c += dc;
  }
  return result.length > 1 ? result : [index];
}

export type LetterMode = 'by-number' | 'starter-only';

export function displayedLetter(
  cell: Extract<PlayCell, { kind: 'letter' }>,
  letters: Readonly<Record<number, string>>,
  mode: LetterMode,
): string | undefined {
  return mode === 'starter-only' ? cell.given : letters[cell.number];
}
