import { describe, expect, it } from 'vitest';
import { formatRows, parseRows } from './rows.ts';
import { extractSlots, letterComponents } from './slots.ts';

describe('parseRows / formatRows', () => {
  it('разбирает и печатает сетку обратно', () => {
    const rows = ['..ДОМ', '..У#И', 'БАР_Р'];
    expect(formatRows(parseRows(rows))).toEqual(rows);
  });

  it('отклоняет строки разной длины', () => {
    expect(() => parseRows(['АБ', 'В'])).toThrow();
  });
});

describe('extractSlots', () => {
  it('находит цепочки длины 2+ в обоих направлениях', () => {
    const grid = parseRows(['ДОМ#', 'У#И#', 'БАР#', '#..А']);
    const slots = extractSlots(grid, (i) => grid.kinds[i] === 'letter');
    expect(slots.map((s) => `${s.dir}:${s.row},${s.col}:${s.length}`)).toEqual([
      'across:0,0:3',
      'across:2,0:3',
      'down:0,0:3',
      'down:0,2:3',
    ]);
  });

  it('не считает одиночную клетку словом и учитывает void как границу', () => {
    const grid = parseRows(['А.Б', '#.#']);
    expect(extractSlots(grid, (i) => grid.kinds[i] === 'letter')).toEqual([]);
  });
});

describe('letterComponents', () => {
  it('находит несвязные области', () => {
    const grid = parseRows(['АБ#', '##В']);
    expect(letterComponents(grid, (i) => grid.kinds[i] === 'letter')).toHaveLength(2);
  });
});
