import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../src/core/alphabet.ts';
import { dictionaryFromFile } from '../src/core/dictionary/loader.ts';
import { generatePuzzle } from '../src/core/puzzle/generatePuzzle.ts';
import type { LetterCell, Puzzle } from '../src/core/puzzle/types.ts';
import { verifyPuzzle } from '../src/core/puzzle/verifyPuzzle.ts';
import { ExchangeError, createExport, exportFileName, parseExport, serializeExport } from '../src/storage/exchange.ts';
import { importPuzzles } from '../src/storage/importPuzzles.ts';
import { PuzzleRepository } from '../src/storage/puzzleRepository.ts';
import type { SavedPuzzle } from '../src/storage/types.ts';

const dictionary = dictionaryFromFile(
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../public/dict/ru-nouns.v1.json'), 'utf8')),
  RU_ALPHABET,
);

function makePuzzle(seed: number, heading: string): Puzzle {
  const result = generatePuzzle(
    {
      id: `p-${seed}`,
      title: heading,
      theme: 'тест',
      difficulty: 'medium',
      seed,
      createdAt: '2026-11-22T00:00:00.000Z',
      editorial: { rubric: '', heading, riddle: 'Загадка', explanation: 'Пояснение', answer: 'зеркало' },
      illustration: { src: 'data:image/png;base64,AAAA', alt: '', prompt: '', placeholder: false },
    },
    { dictionary, alphabet: RU_ALPHABET },
  );
  if (result.status !== 'ok') throw new Error(result.reason);
  return result.puzzle;
}

const saved = (puzzle: Puzzle, progress: Record<number, string> = {}, solved = false): SavedPuzzle => ({
  id: puzzle.meta.id,
  puzzle,
  progress,
  solved,
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-21T10:00:00.000Z',
});

const NOW = new Date('2026-11-22T12:00:00.000Z');

describe('экспорт и импорт JSON', () => {
  let first: Puzzle;
  let second: Puzzle;
  let repo: PuzzleRepository;

  beforeAll(() => {
    first = makePuzzle(1, 'Первая загадка');
    second = makePuzzle(2, 'Вторая');
  });

  beforeEach(() => {
    repo = new PuzzleRepository({ factory: new IDBFactory(), now: () => NOW });
  });

  afterEach(() => repo.close());

  const deps = () => ({
    alphabetId: RU_ALPHABET.id,
    validate: async (puzzle: Puzzle) => verifyPuzzle(puzzle, { dictionary, alphabet: RU_ALPHABET }),
    store: (item: Parameters<PuzzleRepository['importItem']>[0]) => repo.importItem(item),
  });

  it('экспорт не включает отчёт валидации и даёт понятное имя файла', () => {
    const file = createExport([saved(first)], NOW);
    expect(file.format).toBe('keywords-export');
    expect(file.items[0]?.puzzle).not.toHaveProperty('validation');
    expect(exportFileName([saved(first)], NOW)).toBe('keywords-первая-загадка-2026-11-22.json');
    expect(exportFileName([saved(first), saved(second)], NOW)).toBe('keywords-2026-11-22.json');
  });

  it('переносит головоломки с прогрессом и заново их проверяет', async () => {
    const letter = first.cipher.find((e) => !first.givens.includes(e.number)) as { number: number; letter: string };
    const text = serializeExport(createExport([saved(first, { [letter.number]: letter.letter }, false), saved(second, {}, true)], NOW));

    const report = await importPuzzles(text, deps());
    expect(report.added).toEqual(['«Первая загадка»', '«Вторая»']);
    expect(report.rejected).toEqual([]);

    const loaded = await repo.get(first.meta.id);
    expect(loaded?.progress).toEqual({ [letter.number]: letter.letter });
    expect(loaded?.createdAt).toBe('2026-11-20T10:00:00.000Z');
    expect(loaded?.puzzle.validation?.valid).toBe(true);
    expect((await repo.get(second.meta.id))?.solved).toBe(true);
  });

  it('не перезаписывает уже существующие головоломки', async () => {
    await repo.save(first);
    await repo.saveProgress(first.meta.id, { 99: 'Я' }, false);
    const text = serializeExport(createExport([saved(first, {}, true)], NOW));

    const report = await importPuzzles(text, deps());
    expect(report.skipped).toEqual(['«Первая загадка»']);
    expect(report.added).toEqual([]);
    expect((await repo.get(first.meta.id))?.progress).toEqual({ 99: 'Я' });
  });

  it('отклоняет головоломку, изменённую вручную', async () => {
    const tampered: Puzzle = {
      ...first,
      grid: {
        ...first.grid,
        cells: first.grid.cells.map((cell, i) =>
          i === first.grid.cells.findIndex((c) => c.kind === 'letter') ? { ...(cell as LetterCell), letter: 'Щ' } : cell,
        ),
      },
    };
    const report = await importPuzzles(serializeExport(createExport([saved(tampered)], NOW)), deps());
    expect(report.added).toEqual([]);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0]?.reason).toMatch(/не прошла проверку/);
    expect(await repo.get(first.meta.id)).toBeNull();
  });

  it('отклоняет битые записи, чужой алфавит и повтор id, остальное импортирует', async () => {
    const file = createExport([saved(first), saved(first)], NOW);
    const broken = {
      ...file,
      items: [
        ...file.items,
        { puzzle: { ...second, grid: { ...second.grid, cells: [{ kind: 'letter' }] } } },
        { puzzle: { ...second, meta: { ...second.meta, id: 'x', alphabet: 'ru-33' } } },
        'мусор',
      ],
    };
    const report = await importPuzzles(JSON.stringify(broken), deps());
    expect(report.added).toEqual(['«Первая загадка»']);
    expect(report.rejected.map((r) => r.reason)).toEqual([
      'повтор id внутри файла',
      'у буквенной клетки нет буквы',
      'алфавит ru-33 не поддерживается',
      'запись не объект',
    ]);
  });

  it('очищает прогресс от несуществующих номеров и мусора', () => {
    const text = serializeExport(createExport([saved(first, { 999: 'А', 1: 'АБ' } as Record<number, string>)], NOW));
    expect(parseExport(text, RU_ALPHABET.id).items[0]?.progress).toEqual({});
  });

  it('сообщает о неверном файле целиком', () => {
    expect(() => parseExport('не json', RU_ALPHABET.id)).toThrow(ExchangeError);
    expect(() => parseExport('{"format":"other"}', RU_ALPHABET.id)).toThrow('Это не файл экспорта кейвордов');
    expect(() => parseExport('{"format":"keywords-export","version":2,"items":[]}', RU_ALPHABET.id)).toThrow(/версия/);
  });

  it('экспортирует все записи из хранилища', async () => {
    await repo.save(first);
    await repo.save(second);
    const records = await repo.listRecords();
    expect(records.map((r) => r.id).sort()).toEqual([first.meta.id, second.meta.id].sort());
  });
});
