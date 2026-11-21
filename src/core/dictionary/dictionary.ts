import type { Alphabet } from '../alphabet.ts';
import { letterIndex } from '../alphabet.ts';
import type { Bitset } from './bitset.ts';
import { andInto, createBitset, hasBit, iterateBits, popcount, setBit } from './bitset.ts';
import type { DictionaryEntry } from './types.ts';

export type Pattern = readonly (string | null)[];

interface Bucket {
  readonly entries: readonly DictionaryEntry[];
  readonly masks: readonly (readonly Bitset[])[];
}

export interface DictionaryFilter {
  minIpm?: number;
  minLength?: number;
  maxLength?: number;
}

export class Dictionary {
  readonly alphabet: Alphabet;
  readonly size: number;
  private readonly letterToIndex: ReadonlyMap<string, number>;
  private readonly buckets: ReadonlyMap<number, Bucket>;
  private readonly lookup: ReadonlyMap<string, DictionaryEntry>;

  constructor(entries: readonly DictionaryEntry[], alphabet: Alphabet) {
    this.alphabet = alphabet;
    this.letterToIndex = letterIndex(alphabet);

    const lookup = new Map<string, DictionaryEntry>();
    for (const entry of entries) {
      const existing = lookup.get(entry.word);
      if (!existing || existing.ipm < entry.ipm) lookup.set(entry.word, entry);
    }
    this.lookup = lookup;
    this.size = lookup.size;

    const byLength = new Map<number, DictionaryEntry[]>();
    for (const entry of lookup.values()) {
      for (const char of entry.word) {
        if (!this.letterToIndex.has(char)) {
          throw new Error(`Слово «${entry.word}» содержит букву вне алфавита ${alphabet.id}`);
        }
      }
      const list = byLength.get(entry.word.length) ?? [];
      list.push(entry);
      byLength.set(entry.word.length, list);
    }

    const buckets = new Map<number, Bucket>();
    for (const [length, list] of byLength) {
      list.sort((a, b) => b.ipm - a.ipm || (a.word < b.word ? -1 : 1));
      buckets.set(length, { entries: list, masks: this.buildMasks(list, length) });
    }
    this.buckets = buckets;
  }

  private buildMasks(list: readonly DictionaryEntry[], length: number): Bitset[][] {
    const letters = this.alphabet.letters.length;
    const masks = Array.from({ length }, () =>
      Array.from({ length: letters }, () => createBitset(list.length)),
    );
    list.forEach((entry, wordIndex) => {
      [...entry.word].forEach((char, position) => {
        const letter = this.letterToIndex.get(char);
        const mask = letter === undefined ? undefined : masks[position]?.[letter];
        if (mask) setBit(mask, wordIndex);
      });
    });
    return masks;
  }

  entries(): DictionaryEntry[] {
    return [...this.lookup.values()];
  }

  has(word: string): boolean {
    return this.lookup.has(word);
  }

  get(word: string): DictionaryEntry | undefined {
    return this.lookup.get(word);
  }

  lengths(): number[] {
    return [...this.buckets.keys()].sort((a, b) => a - b);
  }

  countByLength(length: number): number {
    return this.buckets.get(length)?.entries.length ?? 0;
  }

  candidates(pattern: Pattern): Bitset {
    const bucket = this.buckets.get(pattern.length);
    if (!bucket) return createBitset(0);
    const result = createBitset(bucket.entries.length, true);
    for (let position = 0; position < pattern.length; position += 1) {
      const char = pattern[position];
      if (char === null || char === undefined) continue;
      const letter = this.letterToIndex.get(char);
      const mask = letter === undefined ? undefined : bucket.masks[position]?.[letter];
      if (!mask) return createBitset(bucket.entries.length);
      andInto(result, mask);
    }
    return result;
  }

  countMatches(pattern: Pattern): number {
    return popcount(this.candidates(pattern));
  }

  matches(pattern: Pattern): DictionaryEntry[] {
    const bucket = this.buckets.get(pattern.length);
    if (!bucket) return [];
    return [...iterateBits(this.candidates(pattern))].map((i) => bucket.entries[i] as DictionaryEntry);
  }

  entryAt(length: number, index: number): DictionaryEntry | undefined {
    return this.buckets.get(length)?.entries[index];
  }

  isCandidate(bits: Bitset, index: number): boolean {
    return hasBit(bits, index);
  }

  filter({ minIpm = 0, minLength = 1, maxLength = Infinity }: DictionaryFilter): Dictionary {
    const entries = [...this.lookup.values()].filter(
      (e) => e.ipm >= minIpm && e.word.length >= minLength && e.word.length <= maxLength,
    );
    return new Dictionary(entries, this.alphabet);
  }

  withWords(words: readonly string[], ipm = 0): Dictionary {
    const extra = words.filter((w) => !this.lookup.has(w)).map((word) => ({ word, ipm }));
    return new Dictionary([...this.lookup.values(), ...extra], this.alphabet);
  }
}
