import { describe, expect, it } from 'vitest';
import { createRng } from './rng.ts';

describe('createRng', () => {
  it('детерминирован по seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('разные seed дают разные последовательности', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('int возвращает значения в диапазоне', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.int(5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
    }
    expect(() => rng.int(0)).toThrow(RangeError);
  });

  it('shuffle сохраняет элементы и не меняет исходный массив', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createRng(3).shuffle(source);
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(source);
  });
});
