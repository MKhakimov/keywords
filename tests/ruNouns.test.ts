import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../src/core/alphabet.ts';
import { dictionaryFromFile } from '../src/core/dictionary/loader.ts';

const raw: unknown = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../public/dict/ru-nouns.v1.json'), 'utf8'),
);

describe('ru-nouns.v1.json', () => {
  const dict = dictionaryFromFile(raw, RU_ALPHABET);

  it('загружается и содержит ожидаемый объём слов', () => {
    expect(dict.size).toBeGreaterThan(20000);
  });

  it('содержит слова из референса', () => {
    for (const word of ['ПОВАР', 'ЗАПЕВ', 'ОЗЕРО', 'ИВАСИ']) {
      expect(dict.has(word), word).toBe(true);
    }
  });

  it('не содержит слов из стоп-листа и Ё', () => {
    for (const word of ['ЖОПА', 'ИДИОТ', 'ЭМ']) expect(dict.has(word), word).toBe(false);
  });

  it('отклоняет файл для другого алфавита', () => {
    expect(() => dictionaryFromFile({ ...(raw as object), alphabet: 'ru-33' }, RU_ALPHABET)).toThrow();
  });
});
