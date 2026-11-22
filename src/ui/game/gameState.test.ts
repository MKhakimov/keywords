import { describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../../core/alphabet.ts';
import { parseRows } from '../../core/grid/rows.ts';
import { extractSlots } from '../../core/grid/slots.ts';
import { assemblePuzzle } from '../../core/puzzle/assemble.ts';
import type { PlacedWord, Puzzle } from '../../core/puzzle/types.ts';
import { toPlayView } from '../../core/puzzle/views.ts';
import { checkSolution } from './checkSolution.ts';
import type { GameState } from './gameState.ts';
import { createGameReducer, initialGameState } from './gameState.ts';

// ДОМ.
// У#И.
// БАР.   стартовое слово — ДУБ (Д=1, У=2, Б=3)
function buildPuzzle(): Puzzle {
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
    meta: {
      id: 't',
      title: '',
      theme: '',
      difficulty: 'easy',
      language: 'ru',
      alphabet: RU_ALPHABET.id,
      seed: 1,
      createdAt: '',
    },
    editorial: { rubric: '', heading: '', riddle: '', explanation: '', answer: 'мир' },
    illustration: { src: '', alt: '', prompt: '', placeholder: true },
  });
}

const puzzle = buildPuzzle();
const view = toPlayView(puzzle);
const reduce = createGameReducer(view, RU_ALPHABET);
const run = (state: GameState, ...actions: Parameters<typeof reduce>[1][]) => actions.reduce(reduce, state);
const start = initialGameState(view);
const cellIndex = (row: number, col: number) => row * 4 + col;

describe('игровое состояние', () => {
  it('начинает со стартовых букв', () => {
    expect(start.entries).toEqual({ 1: 'Д', 2: 'У', 3: 'Б' });
  });

  it('вписывает букву для номера и переходит к следующей клетке', () => {
    const state = run(start, { type: 'select', index: cellIndex(0, 1) }, { type: 'input', letter: 'о' });
    expect(state.entries[4]).toBe('О');
    expect(state.selected).toBe(cellIndex(0, 2));
  });

  it('заменяет Ё на Е и игнорирует не-буквы', () => {
    const selected = run(start, { type: 'select', index: cellIndex(0, 1) });
    expect(run(selected, { type: 'input', letter: 'ё' }).entries[4]).toBe('Е');
    expect(run(selected, { type: 'input', letter: '7' })).toBe(selected);
  });

  it('не меняет стартовые буквы и не даёт использовать их для другого номера', () => {
    const onGiven = run(start, { type: 'select', index: cellIndex(0, 0) }, { type: 'input', letter: 'К' });
    expect(onGiven.entries[1]).toBe('Д');
    const reuse = run(start, { type: 'select', index: cellIndex(0, 1) }, { type: 'input', letter: 'Д' });
    expect(reuse.entries[4]).toBeUndefined();
  });

  it('сообщает, что буква уже открыта как стартовая, и не двигает курсор', () => {
    const state = run(start, { type: 'select', index: cellIndex(0, 1) }, { type: 'input', letter: 'д' });
    expect(state.notice).toEqual({ kind: 'given-letter', letter: 'Д', number: 1 });
    expect(state.entries[4]).toBeUndefined();
    expect(state.selected).toBe(cellIndex(0, 1));
  });

  it('сообщает о попытке изменить стартовую букву, а совпадающую просто пропускает', () => {
    const selected = run(start, { type: 'select', index: cellIndex(0, 0) });
    const changed = run(selected, { type: 'input', letter: 'К' });
    expect(changed.notice).toEqual({ kind: 'given-cell', letter: 'Д', number: 1 });
    expect(changed.selected).toBe(cellIndex(0, 0));
    const same = run(selected, { type: 'input', letter: 'Д' });
    expect(same.notice).toBeNull();
    expect(same.selected).toBe(cellIndex(0, 1));
  });

  it('сообщает о переносе буквы с другого номера', () => {
    const state = run(
      start,
      { type: 'select', index: cellIndex(0, 1) },
      { type: 'input', letter: 'О' },
      { type: 'select', index: cellIndex(2, 1) },
      { type: 'input', letter: 'О' },
    );
    expect(state.notice).toEqual({ kind: 'moved', letter: 'О', from: 4, to: 7 });
    const again = run(state, { type: 'select', index: cellIndex(2, 1) }, { type: 'input', letter: 'О' });
    expect(again.notice).toBeNull();
  });

  it('снимает уведомление при следующем действии', () => {
    const noticed = run(start, { type: 'select', index: cellIndex(0, 1) }, { type: 'input', letter: 'Д' });
    expect(run(noticed, { type: 'move', dRow: 0, dCol: 1 }).notice).toBeNull();
    expect(run(noticed, { type: 'erase' }).notice).toBeNull();
  });

  it('снимает букву с прежнего номера, если её вписали в другой', () => {
    const state = run(
      start,
      { type: 'select', index: cellIndex(0, 1) },
      { type: 'input', letter: 'О' },
      { type: 'select', index: cellIndex(2, 1) },
      { type: 'input', letter: 'О' },
    );
    expect(state.entries[4]).toBeUndefined();
    expect(state.entries[7]).toBe('О');
  });

  it('стирает текущую букву, а на пустой клетке — предыдущую', () => {
    const typed = run(start, { type: 'select', index: cellIndex(0, 1) }, { type: 'input', letter: 'О' });
    const erased = run(typed, { type: 'erase' });
    expect(erased.entries[4]).toBeUndefined();
    expect(erased.selected).toBe(cellIndex(0, 1));
  });

  it('переключает направление повторным щелчком и двигается стрелками через блоки', () => {
    const selected = run(start, { type: 'select', index: cellIndex(0, 0) });
    expect(run(selected, { type: 'select', index: cellIndex(0, 0) }).direction).toBe('down');
    const moved = run(start, { type: 'select', index: cellIndex(1, 0) }, { type: 'move', dRow: 0, dCol: 1 });
    expect(moved.selected).toBe(cellIndex(1, 2));
  });

  it('восстанавливает сохранённый прогресс, отбрасывая некорректные записи', () => {
    const restored = initialGameState(view, { 4: 'О', 5: 'О', 1: 'К', 99: 'Я', 6: 'Д', 7: 'ЖЖ' });
    expect(restored.entries).toEqual({ 1: 'Д', 2: 'У', 3: 'Б', 4: 'О' });
  });

  it('ставит «решено» по верной проверке и снимает при изменении букв', () => {
    const solved = run(start, { type: 'checked', result: { wrong: [], missing: 0, solved: true } });
    expect(solved.solved).toBe(true);
    const edited = run(solved, { type: 'select', index: cellIndex(0, 1) }, { type: 'input', letter: 'О' });
    expect(edited.solved).toBe(false);
    expect(initialGameState(view, {}, true).solved).toBe(true);
  });

  it('сбрасывает игру к стартовым буквам', () => {
    const typed = run(start, { type: 'select', index: cellIndex(0, 1) }, { type: 'input', letter: 'О' });
    expect(run(typed, { type: 'reset' })).toEqual(start);
  });
});

describe('checkSolution', () => {
  it('находит неверные и пустые номера', () => {
    const result = checkSolution(puzzle, { ...start.entries, 4: 'О', 5: 'К' });
    expect(result.wrong).toEqual([5]);
    expect(result.missing).toBe(3);
    expect(result.solved).toBe(false);
  });

  it('признаёт полное верное решение', () => {
    const entries = Object.fromEntries(puzzle.cipher.map((e) => [e.number, e.letter]));
    expect(checkSolution(puzzle, entries)).toEqual({ wrong: [], missing: 0, solved: true });
  });
});
