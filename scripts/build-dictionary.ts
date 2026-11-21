import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { RU_ALPHABET, normalizeWord } from '../src/core/alphabet.ts';
import type { DictionaryFile } from '../src/core/dictionary/types.ts';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = resolve(ROOT, process.argv[2] ?? '.cache/sources/freq2011/freqrnc2011.csv');
const STOPLIST = resolve(ROOT, 'data/dictionary/stoplist.txt');
const WHITELIST = resolve(ROOT, 'data/dictionary/whitelist.txt');
const OUTPUT = resolve(ROOT, 'public/dict/ru-nouns.v1.json');

const MIN_LENGTH = 2;
const MAX_LENGTH = 15;
const WHITELIST_IPM = 0.1;

async function readList(path: string): Promise<string[]> {
  const text = await readFile(path, 'utf8');
  return text
    .split('\n')
    .map((line) => line.replace(/#.*/u, '').trim())
    .filter((line) => line.length > 0);
}

function normalizeListEntry(raw: string, path: string): string {
  const word = normalizeWord(raw, RU_ALPHABET);
  if (word === null) throw new Error(`Недопустимое слово «${raw}» в ${path}`);
  return word;
}

async function main(): Promise<void> {
  const csv = await readFile(SOURCE, 'utf8');
  const stoplist = new Set((await readList(STOPLIST)).map((w) => normalizeListEntry(w, STOPLIST)));
  const whitelist = (await readList(WHITELIST)).map((w) => normalizeListEntry(w, WHITELIST));

  const frequencies = new Map<string, number>();
  const rejected = { notNoun: 0, invalidChars: 0, length: 0, stoplist: 0 };

  for (const line of csv.split('\n').slice(1)) {
    if (line.trim() === '') continue;
    const [lemma, pos, ipmRaw] = line.split('\t');
    if (lemma === undefined || pos === undefined || ipmRaw === undefined) continue;
    if (pos !== 's') {
      rejected.notNoun += 1;
      continue;
    }
    const word = normalizeWord(lemma, RU_ALPHABET);
    if (word === null) {
      rejected.invalidChars += 1;
      continue;
    }
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) {
      rejected.length += 1;
      continue;
    }
    if (stoplist.has(word)) {
      rejected.stoplist += 1;
      continue;
    }
    const ipm = Number.parseFloat(ipmRaw);
    frequencies.set(word, Math.max(frequencies.get(word) ?? 0, Number.isFinite(ipm) ? ipm : 0));
  }

  for (const word of whitelist) {
    if (!frequencies.has(word)) frequencies.set(word, WHITELIST_IPM);
  }

  const words = [...frequencies.entries()]
    .sort(([a, fa], [b, fb]) => fb - fa || a.localeCompare(b, 'ru'))
    .map(([word, ipm]) => [word, Math.round(ipm * 10) / 10] as [string, number]);

  const file: DictionaryFile = {
    format: 'ru-nouns',
    version: 1,
    alphabet: RU_ALPHABET.id,
    attribution:
      'О. Н. Ляшевская, С. А. Шаров. Частотный словарь современного русского языка (на материалах НКРЯ). М.: Азбуковник, 2009. http://dict.ruslang.ru/freq.php',
    words,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(file));

  const byLength = new Map<number, number>();
  for (const [word] of words) byLength.set(word.length, (byLength.get(word.length) ?? 0) + 1);
  console.log(`Слов: ${words.length}`);
  console.log('Отброшено:', rejected);
  console.log('По длине:', Object.fromEntries([...byLength.entries()].sort(([a], [b]) => a - b)));
}

await main();
