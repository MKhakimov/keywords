import { describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../../core/alphabet.ts';
import { parseRows } from '../../core/grid/rows.ts';
import { extractSlots } from '../../core/grid/slots.ts';
import { assemblePuzzle } from '../../core/puzzle/assemble.ts';
import { toPlayView } from '../../core/puzzle/views.ts';
import { givenEntries } from '../game/gameState.ts';
import { displayedLetter } from './gridGeometry.ts';

// ДОМ.
// У#И.
// БАД.   стартовое слово — ДУБ; буква Д (номер 1) есть ещё в клетке (2, 2)
const grid = parseRows(['ДОМ.', 'У#И.', 'БАД.']);
const view = toPlayView(
  assemblePuzzle({
    grid,
    words: extractSlots(grid, (i) => grid.kinds[i] === 'letter').map((slot) => ({
      word: slot.cells.map((i) => grid.letters[i]).join(''),
      row: slot.row,
      col: slot.col,
      dir: slot.dir,
    })),
    answerParts: [{ text: 'МИД', row: 0, col: 2, dir: 'down' }],
    letterOrder: ['Д', 'У', 'Б', 'О', 'М', 'И', 'А'],
    starter: { word: 'ДУБ', row: 0, col: 0, dir: 'down' },
    meta: { id: 't', title: '', theme: '', difficulty: 'easy', language: 'ru', alphabet: RU_ALPHABET.id, seed: 1, createdAt: '' },
    editorial: { rubric: '', heading: '', riddle: '', explanation: '', answer: 'мид' },
    illustration: { src: '', alt: '', prompt: '', placeholder: true },
  }),
);

const letterAt = (row: number, col: number, mode: 'by-number' | 'starter-only') => {
  const cell = view.grid.cells[row * view.grid.width + col];
  if (cell?.kind !== 'letter') throw new Error('not a letter cell');
  return displayedLetter(cell, givenEntries(view), mode);
};

describe('displayedLetter', () => {
  it('в игре стартовые буквы стоят во всех клетках своих номеров', () => {
    expect(letterAt(0, 0, 'by-number')).toBe('Д');
    expect(letterAt(2, 2, 'by-number')).toBe('Д');
    expect(letterAt(0, 1, 'by-number')).toBeUndefined();
  });

  it('на печати буквы есть только в клетках стартового слова', () => {
    expect([letterAt(0, 0, 'starter-only'), letterAt(1, 0, 'starter-only'), letterAt(2, 0, 'starter-only')]).toEqual(['Д', 'У', 'Б']);
    expect(letterAt(2, 2, 'starter-only')).toBeUndefined();
    expect(letterAt(0, 1, 'starter-only')).toBeUndefined();
  });
});
