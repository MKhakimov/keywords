import type { Rng } from '../rng.ts';

export interface Rect {
  readonly row: number;
  readonly col: number;
  readonly width: number;
  readonly height: number;
}

export type FixedCell =
  | { readonly kind: 'void' }
  | { readonly kind: 'block' }
  | { readonly kind: 'letter'; readonly letter: string; readonly answerPart: number };

export interface AnswerPlacement {
  readonly text: string;
  readonly row: number;
  readonly col: number;
  readonly dir: 'down';
}

export interface LayoutInput {
  readonly width: number;
  readonly height: number;
  readonly voids: readonly Rect[];
  readonly answerColumn: number;
  readonly answerParts: readonly string[];
  readonly rng: Rng;
}

export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly fixed: readonly (FixedCell | null)[];
  readonly answer: readonly AnswerPlacement[];
}

export class LayoutError extends Error {}

export function planLayout(input: LayoutInput): Layout {
  const { width, height, rng } = input;
  const fixed: (FixedCell | null)[] = Array.from({ length: width * height }, () => null);

  for (const rect of input.voids) {
    for (let r = rect.row; r < rect.row + rect.height; r += 1) {
      for (let c = rect.col; c < rect.col + rect.width; c += 1) {
        if (r >= 0 && c >= 0 && r < height && c < width) fixed[r * width + c] = { kind: 'void' };
      }
    }
  }

  const col = input.answerColumn;
  if (col < 0 || col >= width) throw new LayoutError(`Колонка ответа ${col} вне сетки шириной ${width}`);
  if (input.answerParts.length === 0) throw new LayoutError('Ответ не задан');
  for (const part of input.answerParts) {
    if (part.length < 2) throw new LayoutError(`Часть ответа «${part}» короче двух букв — её нельзя разместить отдельным словом`);
  }

  let top = 0;
  while (top < height && fixed[top * width + col]?.kind === 'void') top += 1;
  let bottom = top;
  while (bottom < height && fixed[bottom * width + col]?.kind !== 'void') bottom += 1;
  const available = bottom - top;

  const lengths = input.answerParts.map((p) => p.length);
  const reachesBottom = bottom === height;
  const minimum = lengths.reduce((sum, l) => sum + l + 1, 0) + (reachesBottom ? 0 : 1);
  if (minimum > available) {
    throw new LayoutError(`Ответ «${input.answerParts.join(' ')}» не помещается в колонку высотой ${available}`);
  }

  const gaps = lengths.map(() => 1);
  let slack = available - minimum;
  while (slack > 0) {
    const gapIndex = rng.int(gaps.length + 1);
    if (gapIndex < gaps.length) gaps[gapIndex] = (gaps[gapIndex] ?? 1) + 1;
    slack -= 1;
  }

  const answer: AnswerPlacement[] = [];
  let row = top;
  input.answerParts.forEach((text, i) => {
    row += gaps[i] ?? 1;
    fixed[(row - 1) * width + col] = { kind: 'block' };
    [...text].forEach((letter, k) => {
      fixed[(row + k) * width + col] = { kind: 'letter', letter, answerPart: i + 1 };
    });
    const end = row + text.length;
    if (end < height && fixed[end * width + col]?.kind !== 'void') fixed[end * width + col] = { kind: 'block' };
    answer.push({ text, row, col, dir: 'down' });
    row = end;
  });

  return { width, height, fixed, answer };
}
