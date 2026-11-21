export interface Alphabet {
  readonly id: string;
  readonly letters: readonly string[];
  readonly substitutions: Readonly<Record<string, string>>;
}

export const RU_ALPHABET: Alphabet = {
  id: 'ru-32',
  letters: [...'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'],
  substitutions: { Ё: 'Е' },
};

export function letterIndex(alphabet: Alphabet): ReadonlyMap<string, number> {
  return new Map(alphabet.letters.map((letter, index) => [letter, index]));
}

export function normalizeWord(raw: string, alphabet: Alphabet): string | null {
  const allowed = new Set(alphabet.letters);
  let result = '';
  for (const char of raw.trim().toLocaleUpperCase('ru-RU')) {
    const letter = alphabet.substitutions[char] ?? char;
    if (!allowed.has(letter)) return null;
    result += letter;
  }
  return result.length > 0 ? result : null;
}

export function normalizeAnswer(raw: string, alphabet: Alphabet): string[] | null {
  const parts = raw
    .split(/[\s\-–—]+/u)
    .map((part) => part.replace(/[.,!?;:«»"'()…]/gu, ''))
    .filter((part) => part.length > 0);
  if (parts.length === 0) return null;
  const normalized: string[] = [];
  for (const part of parts) {
    const word = normalizeWord(part, alphabet);
    if (word === null) return null;
    normalized.push(word);
  }
  return normalized;
}
