import { describe, expect, it } from 'vitest';
import { RU_ALPHABET, normalizeAnswer, normalizeWord } from './alphabet.ts';

describe('RU_ALPHABET', () => {
  it('содержит 32 уникальные буквы без Ё', () => {
    expect(RU_ALPHABET.letters).toHaveLength(32);
    expect(new Set(RU_ALPHABET.letters).size).toBe(32);
    expect(RU_ALPHABET.letters).not.toContain('Ё');
    expect(RU_ALPHABET.letters).toContain('Й');
    expect(RU_ALPHABET.letters).toContain('Ъ');
  });
});

describe('normalizeWord', () => {
  it('приводит к верхнему регистру и заменяет Ё на Е', () => {
    expect(normalizeWord('ёлка', RU_ALPHABET)).toBe('ЕЛКА');
    expect(normalizeWord('  Запев ', RU_ALPHABET)).toBe('ЗАПЕВ');
  });

  it('отклоняет слова с недопустимыми символами', () => {
    expect(normalizeWord('иван-чай', RU_ALPHABET)).toBeNull();
    expect(normalizeWord('кот2', RU_ALPHABET)).toBeNull();
    expect(normalizeWord('cat', RU_ALPHABET)).toBeNull();
    expect(normalizeWord('', RU_ALPHABET)).toBeNull();
  });
});

describe('normalizeAnswer', () => {
  it('разбивает фразу на части', () => {
    expect(normalizeAnswer('в отчаяние', RU_ALPHABET)).toEqual(['В', 'ОТЧАЯНИЕ']);
    expect(normalizeAnswer('«Ёж — иголки!»', RU_ALPHABET)).toEqual(['ЕЖ', 'ИГОЛКИ']);
  });

  it('отклоняет пустой ответ и латиницу', () => {
    expect(normalizeAnswer('  ', RU_ALPHABET)).toBeNull();
    expect(normalizeAnswer('кот cat', RU_ALPHABET)).toBeNull();
  });
});
