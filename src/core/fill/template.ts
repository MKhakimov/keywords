import { extractSlots, letterComponents } from '../grid/slots.ts';
import type { CellKind } from '../grid/types.ts';
import type { Rng } from '../rng.ts';
import type { Layout } from './layout.ts';

export interface TemplateOptions {
  readonly minWordLength: number;
  readonly maxWordLength: number;
  readonly extraBreakChance: number;
  readonly densifyChance: number;
}

type Axis = 'across' | 'down';

export function generateTemplate(layout: Layout, options: TemplateOptions, rng: Rng): CellKind[] | null {
  const { width, height, fixed } = layout;
  const { minWordLength: minLen, maxWordLength: maxLen } = options;
  const kinds: CellKind[] = fixed.map((cell, i) => {
    if (cell) return cell.kind;
    const r = Math.floor(i / width);
    const c = i % width;
    return r % 2 === 1 && c % 2 === 1 ? 'block' : 'letter';
  });

  const at = (r: number, c: number): CellKind =>
    r < 0 || c < 0 || r >= height || c >= width ? 'void' : (kinds[r * width + c] as CellKind);
  const isLetter = (r: number, c: number) => at(r, c) === 'letter';
  const isFree = (r: number, c: number) => fixed[r * width + c] === null;

  const perpendicularLength = (r: number, c: number, axis: Axis): number => {
    const [dr, dc] = axis === 'across' ? [1, 0] : [0, 1];
    let length = 1;
    for (let k = 1; isLetter(r + dr * k, c + dc * k); k += 1) length += 1;
    for (let k = 1; isLetter(r - dr * k, c - dc * k); k += 1) length += 1;
    return length;
  };

  const lines = (axis: Axis) => (axis === 'across' ? height : width);
  const lineLength = (axis: Axis) => (axis === 'across' ? width : height);
  const cellOf = (axis: Axis, line: number, pos: number): [number, number] =>
    axis === 'across' ? [line, pos] : [pos, line];

  const runsOf = (axis: Axis, line: number): [number, number][] => {
    const runs: [number, number][] = [];
    let start = -1;
    for (let pos = 0; pos <= lineLength(axis); pos += 1) {
      const [r, c] = cellOf(axis, line, pos);
      const letter = pos < lineLength(axis) && isLetter(r, c);
      if (letter && start < 0) start = pos;
      if (!letter && start >= 0) {
        runs.push([start, pos - start]);
        start = -1;
      }
    }
    return runs;
  };

  const breakable = (axis: Axis, line: number, pos: number) => {
    const [r, c] = cellOf(axis, line, pos);
    return isFree(r, c) && perpendicularLength(r, c, axis) === 1;
  };

  const isLattice = (r: number, c: number) => r % 2 === 1 && c % 2 === 1;
  const isExtraBlock = (r: number, c: number) => at(r, c) === 'block' && !isLattice(r, c);

  const stripePenalty = (axis: Axis, line: number, pos: number): number => {
    const [r, c] = cellOf(axis, line, pos);
    const [dr, dc] = axis === 'across' ? [2, 0] : [0, 2];
    return (isExtraBlock(r + dr, c + dc) ? 1 : 0) + (isExtraBlock(r - dr, c - dc) ? 1 : 0);
  };

  const splitRun = (axis: Axis, line: number, start: number, length: number, force: boolean): number[] | null => {
    const search = (from: number): number[] | null => {
      const remaining = start + length - from;
      const mustBreak = force && from === start;
      if (!mustBreak && (remaining === 0 || (remaining >= minLen && remaining <= maxLen))) return [];
      const choices = rng
        .shuffle(Array.from({ length: maxLen - minLen + 1 }, (_, i) => minLen + i))
        .map((piece) => ({ piece, penalty: stripePenalty(axis, line, from + piece) }))
        .sort((a, b) => a.penalty - b.penalty)
        .map(({ piece }) => piece);
      for (const piece of choices) {
        const breakPos = from + piece;
        if (breakPos >= start + length) continue;
        const rest = start + length - breakPos - 1;
        if (rest !== 0 && rest < minLen) continue;
        if (!breakable(axis, line, breakPos)) continue;
        const tail = search(breakPos + 1);
        if (tail) return [breakPos, ...tail];
      }
      return null;
    };
    return search(start);
  };

  for (const axis of ['across', 'down'] as const) {
    for (let line = 0; line < lines(axis); line += 1) {
      for (const [start, length] of runsOf(axis, line)) {
        if (length === 1) continue;
        const isAnswerRun = Array.from({ length }, (_, k) => cellOf(axis, line, start + k)).every(
          ([r, c]) => fixed[r * width + c]?.kind === 'letter',
        );
        if (isAnswerRun) continue;
        const force = length > maxLen || (length >= 2 * minLen + 1 && rng.next() < options.extraBreakChance);
        if (!force && length >= minLen) continue;
        if (length < minLen) return null;
        const breaks = splitRun(axis, line, start, length, true);
        if (!breaks) return null;
        for (const pos of breaks) {
          const [r, c] = cellOf(axis, line, pos);
          kinds[r * width + c] = 'block';
        }
      }
    }
  }

  const validLength = (length: number) => length === 1 || (length >= minLen && length <= maxLen);
  const freeBlocks = rng.shuffle(
    kinds.flatMap((kind, i) => (kind === 'block' && fixed[i] === null ? [i] : [])),
  );
  for (const index of freeBlocks) {
    if (rng.next() >= options.densifyChance) continue;
    const r = Math.floor(index / width);
    const c = index % width;
    kinds[index] = 'letter';
    const vertical = perpendicularLength(r, c, 'across');
    const horizontal = perpendicularLength(r, c, 'down');
    if (!validLength(vertical) || !validLength(horizontal) || (vertical === 1 && horizontal === 1)) {
      kinds[index] = 'block';
    }
  }

  for (let changed = true; changed; ) {
    changed = false;
    for (let r = 0; r < height; r += 1) {
      for (let c = 0; c < width; c += 1) {
        if (!isLetter(r, c)) continue;
        if (perpendicularLength(r, c, 'across') === 1 && perpendicularLength(r, c, 'down') === 1) {
          if (!isFree(r, c)) return null;
          kinds[r * width + c] = 'block';
          changed = true;
        }
      }
    }
  }

  const letterIndex = (i: number) => kinds[i] === 'letter';
  for (const slot of extractSlots(layout, letterIndex)) {
    const answer = slot.cells.every((i) => fixed[i]?.kind === 'letter');
    if (!answer && (slot.length < minLen || slot.length > maxLen)) return null;
  }
  if (letterComponents(layout, letterIndex).length !== 1) return null;

  return kinds;
}
