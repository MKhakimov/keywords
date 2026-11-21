export interface DictionaryFile {
  format: 'ru-nouns';
  version: 1;
  alphabet: string;
  attribution: string;
  words: [word: string, ipm: number][];
}

export interface DictionaryEntry {
  readonly word: string;
  readonly ipm: number;
}
