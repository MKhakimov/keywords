import { RU_ALPHABET } from '../core/alphabet.ts';
import type { Dictionary } from '../core/dictionary/dictionary.ts';
import { dictionaryFromFile } from '../core/dictionary/loader.ts';
import { generatePuzzle } from '../core/puzzle/generatePuzzle.ts';
import { verifyPuzzle } from '../core/puzzle/verifyPuzzle.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

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

function handle(message: WorkerRequest, dictionary: Dictionary): WorkerResponse {
  switch (message.type) {
    case 'generate':
      return { type: 'result', id: message.id, result: generatePuzzle(message.request, { dictionary, alphabet: RU_ALPHABET }) };
    case 'validate':
      return { type: 'validated', id: message.id, report: verifyPuzzle(message.puzzle, { dictionary, alphabet: RU_ALPHABET }) };
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  loadDictionary()
    .then((dictionary) => post(handle(message, dictionary)))
    .catch((error: unknown) =>
      post({ type: 'error', id: message.id, message: error instanceof Error ? error.message : String(error) }),
    );
});
