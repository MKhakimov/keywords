import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.ts';
import { LayoutError, planLayout } from './layout.ts';

const base = { width: 10, height: 12, voids: [{ row: 0, col: 0, width: 3, height: 3 }], answerColumn: 8 };

describe('planLayout', () => {
  it('размещает части ответа сверху вниз с блоками вокруг', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const layout = planLayout({ ...base, answerParts: ['ДОМ', 'МИР'], rng: createRng(seed) });
      expect(layout.answer.map((a) => a.text)).toEqual(['ДОМ', 'МИР']);
      const [first, second] = layout.answer;
      expect(first && second && first.row + 3 < second.row).toBe(true);
      for (const part of layout.answer) {
        expect(layout.fixed[(part.row - 1) * base.width + part.col]).toEqual({ kind: 'block' });
        [...part.text].forEach((letter, k) => {
          expect(layout.fixed[(part.row + k) * base.width + part.col]).toMatchObject({ kind: 'letter', letter });
        });
        const below = part.row + part.text.length;
        if (below < base.height) expect(layout.fixed[below * base.width + part.col]).toEqual({ kind: 'block' });
      }
    }
  });

  it('помечает вырез как void', () => {
    const layout = planLayout({ ...base, answerParts: ['ДОМ'], rng: createRng(1) });
    expect(layout.fixed[0]).toEqual({ kind: 'void' });
    expect(layout.fixed[2 * base.width + 2]).toEqual({ kind: 'void' });
    expect(layout.fixed[3 * base.width]).toBeNull();
  });

  it('сообщает, если ответ не помещается или часть слишком короткая', () => {
    expect(() => planLayout({ ...base, answerParts: ['ПРЕДСТАВИТЕЛЬСТВО'], rng: createRng(1) })).toThrow(LayoutError);
    expect(() => planLayout({ ...base, answerParts: ['В', 'ХРАМ'], rng: createRng(1) })).toThrow(LayoutError);
    expect(() => planLayout({ ...base, answerColumn: 10, answerParts: ['ДОМ'], rng: createRng(1) })).toThrow(LayoutError);
  });
});
