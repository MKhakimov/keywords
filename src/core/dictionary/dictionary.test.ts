import { describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../alphabet.ts';
import { createBitset, iterateBits, popcount, setBit } from './bitset.ts';
import { Dictionary } from './dictionary.ts';

const words = [
  { word: 'КОТ', ipm: 50 },
  { word: 'КИТ', ipm: 10 },
  { word: 'ТОК', ipm: 30 },
  { word: 'ЗАПЕВ', ipm: 1 },
  { word: 'ПОВАР', ipm: 20 },
  { word: 'ОЗЕРО', ipm: 40 },
];

describe('bitset', () => {
  it('считает и перечисляет биты, в том числе за границей 32', () => {
    const bits = createBitset(70);
    [0, 31, 32, 69].forEach((i) => setBit(bits, i));
    expect(popcount(bits)).toBe(4);
    expect([...iterateBits(bits)]).toEqual([0, 31, 32, 69]);
    expect(popcount(createBitset(70, true))).toBe(70);
  });
});

describe('Dictionary', () => {
  const dict = new Dictionary(words, RU_ALPHABET);

  it('проверяет наличие слова', () => {
    expect(dict.has('КОТ')).toBe(true);
    expect(dict.has('КОТЫ')).toBe(false);
  });

  it('ищет по шаблону и сортирует по частоте', () => {
    expect(dict.matches(['К', null, 'Т']).map((e) => e.word)).toEqual(['КОТ', 'КИТ']);
    expect(dict.matches([null, 'О', null]).map((e) => e.word)).toEqual(['КОТ', 'ТОК']);
    expect(dict.countMatches([null, null, null, null, null])).toBe(3);
    expect(dict.countMatches(['Я', null, null])).toBe(0);
    expect(dict.countMatches([null, null, null, null, null, null, null])).toBe(0);
  });

  it('фильтрует по частоте и длине', () => {
    const frequent = dict.filter({ minIpm: 20 });
    expect(frequent.has('ЗАПЕВ')).toBe(false);
    expect(frequent.has('ПОВАР')).toBe(true);
    expect(dict.filter({ minLength: 4 }).lengths()).toEqual([5]);
  });

  it('добавляет слова и отклоняет буквы вне алфавита', () => {
    expect(dict.withWords(['ЕЖ']).has('ЕЖ')).toBe(true);
    expect(() => new Dictionary([{ word: 'ЁЖ', ipm: 1 }], RU_ALPHABET)).toThrow();
  });
});
