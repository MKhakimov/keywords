import type { Alphabet } from '../alphabet.ts';
import { Dictionary } from './dictionary.ts';
import type { DictionaryFile } from './types.ts';

export function isDictionaryFile(value: unknown): value is DictionaryFile {
  if (typeof value !== 'object' || value === null) return false;
  const file = value as Partial<DictionaryFile>;
  return (
    file.format === 'ru-nouns' &&
    file.version === 1 &&
    typeof file.alphabet === 'string' &&
    Array.isArray(file.words) &&
    file.words.every(
      (item) => Array.isArray(item) && typeof item[0] === 'string' && typeof item[1] === 'number',
    )
  );
}

export function dictionaryFromFile(value: unknown, alphabet: Alphabet): Dictionary {
  if (!isDictionaryFile(value)) throw new Error('Неверный формат файла словаря');
  if (value.alphabet !== alphabet.id) {
    throw new Error(`Словарь собран для алфавита ${value.alphabet}, ожидается ${alphabet.id}`);
  }
  return new Dictionary(
    value.words.map(([word, ipm]) => ({ word, ipm })),
    alphabet,
  );
}
