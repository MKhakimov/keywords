import type { Coord, Direction, GridShape, Slot } from './types.ts';

export function toIndex(shape: GridShape, row: number, col: number): number {
  return row * shape.width + col;
}

export function toCoord(shape: GridShape, index: number): Coord {
  return { row: Math.floor(index / shape.width), col: index % shape.width };
}

export function slotCells(shape: GridShape, row: number, col: number, dir: Direction, length: number): number[] {
  return Array.from({ length }, (_, i) =>
    dir === 'across' ? toIndex(shape, row, col + i) : toIndex(shape, row + i, col),
  );
}

export function extractSlots(shape: GridShape, isLetter: (index: number) => boolean): Slot[] {
  const slots: Slot[] = [];
  const scan = (dir: Direction) => {
    const outer = dir === 'across' ? shape.height : shape.width;
    const inner = dir === 'across' ? shape.width : shape.height;
    for (let a = 0; a < outer; a += 1) {
      let start = -1;
      for (let b = 0; b <= inner; b += 1) {
        const row = dir === 'across' ? a : b;
        const col = dir === 'across' ? b : a;
        const letter = b < inner && isLetter(toIndex(shape, row, col));
        if (letter && start === -1) start = b;
        if (!letter && start !== -1) {
          const length = b - start;
          if (length >= 2) {
            const r = dir === 'across' ? a : start;
            const c = dir === 'across' ? start : a;
            slots.push({ id: slots.length, row: r, col: c, dir, length, cells: slotCells(shape, r, c, dir, length) });
          }
          start = -1;
        }
      }
    }
  };
  scan('across');
  scan('down');
  return slots;
}

export function letterComponents(shape: GridShape, isLetter: (index: number) => boolean): number[][] {
  const seen = new Set<number>();
  const components: number[][] = [];
  const total = shape.width * shape.height;
  for (let start = 0; start < total; start += 1) {
    if (!isLetter(start) || seen.has(start)) continue;
    const component: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const index = stack.pop() as number;
      component.push(index);
      const { row, col } = toCoord(shape, index);
      const neighbours = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ] as const;
      for (const [r, c] of neighbours) {
        if (r < 0 || c < 0 || r >= shape.height || c >= shape.width) continue;
        const next = toIndex(shape, r, c);
        if (isLetter(next) && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    components.push(component);
  }
  return components;
}
