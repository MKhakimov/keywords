import { describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../alphabet.ts';
import { Dictionary } from '../dictionary/dictionary.ts';
import type { CipherGridInput } from './uniqueness.ts';
import { solveCipher } from './uniqueness.ts';

const dict = (...words: string[]) => new Dictionary(words.map((word) => ({ word, ipm: 1 })), RU_ALPHABET);
const solve = (input: CipherGridInput, dictionary: Dictionary, nodeBudget = 10_000) =>
  solveCipher(input, { dictionary, alphabet: RU_ALPHABET, nodeBudget });

const row = (numbers: number[], givens: Record<number, string>, exemptSlots: CipherGridInput['exemptSlots'] = []) => ({
  width: numbers.length,
  height: 1,
  numbers,
  givens,
  exemptSlots,
});

describe('solveCipher', () => {
  it('находит единственное решение', () => {
    const result = solve(row([1, 2, 3], { 1: 'К', 3: 'Т' }), dict('КОТ', 'ДОМ'));
    expect(result.verdict).toBe('unique');
    expect(result.solution).toEqual({ 1: 'К', 2: 'О', 3: 'Т' });
  });

  it('видит неоднозначность', () => {
    expect(solve(row([1, 2, 3], { 1: 'К', 3: 'Т' }), dict('КОТ', 'КИТ')).verdict).toBe('ambiguous');
  });

  it('учитывает, что одинаковые номера — одинаковые буквы', () => {
    expect(solve(row([1, 2, 1], { 2: 'О' }), dict('КОТ', 'ТОТ')).solution).toEqual({ 1: 'Т', 2: 'О' });
  });

  it('учитывает, что разные номера — разные буквы', () => {
    expect(solve(row([1, 2, 3], { 2: 'О' }), dict('ТОТ')).verdict).toBe('unsolvable');
  });

  describe('связывает слова через пересечения', () => {
    const square = (givens: Record<number, string>): CipherGridInput => ({
      width: 3,
      height: 3,
      numbers: [1, 2, 3, 4, null, 5, 6, 7, 8],
      givens,
      exemptSlots: [],
    });
    const words = dict('ДОМ', 'ДУБ', 'МИР', 'БАР', 'ДОК', 'ДИВ');

    it('симметричная сетка неоднозначна: транспонирование тоже решение', () => {
      expect(solve(square({ 1: 'Д' }), words).verdict).toBe('ambiguous');
    });

    it('вторая подсказка снимает симметрию', () => {
      const result = solve(square({ 1: 'Д', 2: 'О' }), words);
      expect(result.verdict).toBe('unique');
      expect(result.solution).toEqual({ 1: 'Д', 2: 'О', 3: 'М', 4: 'У', 5: 'И', 6: 'Б', 7: 'А', 8: 'Р' });
    });
  });

  it('не требует словарного слова в частях ответа, но они остаются неоднозначными без пересечений', () => {
    const exempt = [{ row: 0, col: 0, dir: 'across' as const, length: 3 }];
    expect(solve(row([1, 2, 3], { 1: 'Ж', 2: 'Ы', 3: 'Х' }, exempt), dict('КОТ')).verdict).toBe('unique');
    expect(solve(row([1, 2, 3], { 1: 'Ж' }, exempt), dict('КОТ')).verdict).toBe('ambiguous');
  });

  it('возвращает timeout при исчерпании лимита', () => {
    const many = dict('КОТ', 'КИТ', 'ТОК', 'СОК', 'ЛОТ', 'РОТ', 'ПОТ', 'МОХ');
    expect(solve(row([1, 2, 3], {}), many, 1).verdict).toBe('timeout');
  });
});
