import { RU_ALPHABET } from '../core/alphabet.ts';
import type { Dictionary } from '../core/dictionary/dictionary.ts';
import { dictionaryFromFile } from '../core/dictionary/loader.ts';
import { generatePuzzle } from '../core/puzzle/generatePuzzle.ts';
import type { GenerateMessage, WorkerResponse } from './protocol.ts';

const DICTIONARY_URL = `${import.meta.env.BASE_URL}dict/ru-nouns.v1.json`;

let dictionaryPromise: Promise<Dictionary> | null = null;

function loadDictionary(): Promise<Dictionary> {
  dictionaryPromise ??= fetch(DICTIONARY_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Не удалось загрузить словарь: HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then((raw) => dictionaryFromFile(raw, RU_ALPHABET))
    .catch((error: unknown) => {
      dictionaryPromise = null;
      throw error;
    });
  return dictionaryPromise;
}

const post = (message: WorkerResponse) => self.postMessage(message);

self.addEventListener('message', (event: MessageEvent<GenerateMessage>) => {
  const { id, request } = event.data;
  loadDictionary()
    .then((dictionary) => post({ type: 'result', id, result: generatePuzzle(request, { dictionary, alphabet: RU_ALPHABET }) }))
    .catch((error: unknown) => post({ type: 'error', id, message: error instanceof Error ? error.message : String(error) }));
});
