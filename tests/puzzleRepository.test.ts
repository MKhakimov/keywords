import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../src/core/alphabet.ts';
import { parseRows } from '../src/core/grid/rows.ts';
import { extractSlots } from '../src/core/grid/slots.ts';
import { assemblePuzzle } from '../src/core/puzzle/assemble.ts';
import type { PlacedWord, Puzzle } from '../src/core/puzzle/types.ts';
import { PuzzleRepository } from '../src/storage/puzzleRepository.ts';

function makePuzzle(id: string, heading: string): Puzzle {
  const grid = parseRows(['ДОМ.', 'У#И.', 'БАР.']);
  const words: PlacedWord[] = extractSlots(grid, (i) => grid.kinds[i] === 'letter').map((slot) => ({
    word: slot.cells.map((i) => grid.letters[i]).join(''),
    row: slot.row,
    col: slot.col,
    dir: slot.dir,
  }));
  return assemblePuzzle({
    grid,
    words,
    answerParts: [{ text: 'МИР', row: 0, col: 2, dir: 'down' }],
    letterOrder: ['Д', 'У', 'Б', 'О', 'М', 'И', 'А', 'Р'],
    starter: { word: 'ДУБ', row: 0, col: 0, dir: 'down' },
    meta: { id, title: heading, theme: 'тест', difficulty: 'easy', language: 'ru', alphabet: RU_ALPHABET.id, seed: 1, createdAt: '' },
    editorial: { rubric: '', heading, riddle: '', explanation: '', answer: 'мир' },
    illustration: { src: 'data:image/png;base64,AAAA', alt: '', prompt: '', placeholder: false },
  });
}

describe('PuzzleRepository', () => {
  let clock = 0;
  let repo: PuzzleRepository;

  beforeEach(() => {
    clock = Date.UTC(2026, 10, 22);
    repo = new PuzzleRepository({
      factory: new IDBFactory(),
      now: () => {
        clock += 1000;
        return new Date(clock);
      },
    });
  });

  afterEach(() => repo.close());

  it('сохраняет головоломку и читает её обратно без потерь', async () => {
    const puzzle = makePuzzle('a', 'Первая');
    await repo.save(puzzle);
    const loaded = await repo.get('a');
    expect(loaded?.puzzle).toEqual(puzzle);
    expect(loaded?.progress).toEqual({});
    expect(loaded?.solved).toBe(false);
  });

  it('возвращает список, свежие сверху, со сводкой прогресса', async () => {
    await repo.save(makePuzzle('a', 'Первая'));
    await repo.save(makePuzzle('b', 'Вторая'));
    await repo.saveProgress('a', { 1: 'Д', 2: 'У', 3: 'Б', 4: 'О' }, false);

    const list = await repo.list();
    expect(list.map((s) => s.id)).toEqual(['a', 'b']);
    expect(list[0]).toMatchObject({ heading: 'Первая', filled: 4, total: 8, solved: false, width: 4, height: 3 });
  });

  it('сохраняет прогресс и не теряет его при повторном сохранении головоломки', async () => {
    const puzzle = makePuzzle('a', 'Первая');
    const created = await repo.save(puzzle);
    await repo.saveProgress('a', { 4: 'О' }, true);
    const resaved = await repo.save(puzzle);
    expect(resaved.progress).toEqual({ 4: 'О' });
    expect(resaved.solved).toBe(true);
    expect(resaved.createdAt).toBe(created.createdAt);
  });

  it('замена иллюстрации сохраняет прогресс, дату создания и сетку', async () => {
    const puzzle = makePuzzle('a', 'Первая');
    const created = await repo.save(puzzle);
    await repo.saveProgress('a', { 4: 'О' }, false);
    const updated = { ...puzzle, illustration: { ...puzzle.illustration, src: 'data:image/png;base64,BBBB', alt: 'новая' } };
    await repo.save(updated);

    const loaded = await repo.get('a');
    expect(loaded?.puzzle.illustration.src).toBe('data:image/png;base64,BBBB');
    expect(loaded?.puzzle.grid).toEqual(puzzle.grid);
    expect(loaded?.progress).toEqual({ 4: 'О' });
    expect(loaded?.createdAt).toBe(created.createdAt);
  });

  it('удаляет запись', async () => {
    await repo.save(makePuzzle('a', 'Первая'));
    await repo.delete('a');
    expect(await repo.get('a')).toBeNull();
    expect(await repo.list()).toEqual([]);
  });

  it('прогресс для несуществующей записи не создаёт её', async () => {
    expect(await repo.saveProgress('missing', { 1: 'А' }, false)).toBe(false);
    expect(await repo.list()).toEqual([]);
  });

  it('пропускает повреждённые записи', async () => {
    const factory = new IDBFactory();
    const broken = new PuzzleRepository({ factory });
    await broken.save(makePuzzle('ok', 'Целая'));
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open('keywords', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('puzzles', 'readwrite');
      tx.objectStore('puzzles').put({ id: 'bad', schemaVersion: 1, puzzle: null });
      tx.oncomplete = () => resolve();
    });
    db.close();
    expect((await broken.list()).map((s) => s.id)).toEqual(['ok']);
    expect(await broken.get('bad')).toBeNull();
    broken.close();
  });
});
