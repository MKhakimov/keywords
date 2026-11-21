import type { CellKind, GridShape } from './types.ts';

export interface LetterGrid extends GridShape {
  readonly kinds: readonly CellKind[];
  readonly letters: readonly (string | null)[];
}

export const VOID_CHAR = '.';
export const BLOCK_CHAR = '#';
export const EMPTY_CHAR = '_';

export function parseRows(rows: readonly string[]): LetterGrid {
  const height = rows.length;
  const width = Math.max(0, ...rows.map((row) => [...row].length));
  const kinds: CellKind[] = [];
  const letters: (string | null)[] = [];
  for (const row of rows) {
    const chars = [...row];
    if (chars.length !== width) throw new Error(`Строки сетки разной длины: «${row}»`);
    for (const char of chars) {
      if (char === VOID_CHAR) {
        kinds.push('void');
        letters.push(null);
      } else if (char === BLOCK_CHAR) {
        kinds.push('block');
        letters.push(null);
      } else {
        kinds.push('letter');
        letters.push(char === EMPTY_CHAR ? null : char);
      }
    }
  }
  return { width, height, kinds, letters };
}

export function formatRows(grid: LetterGrid): string[] {
  const rows: string[] = [];
  for (let row = 0; row < grid.height; row += 1) {
    let line = '';
    for (let col = 0; col < grid.width; col += 1) {
      const index = row * grid.width + col;
      const kind = grid.kinds[index];
      line += kind === 'void' ? VOID_CHAR : kind === 'block' ? BLOCK_CHAR : (grid.letters[index] ?? EMPTY_CHAR);
    }
    rows.push(line);
  }
  return rows;
}
