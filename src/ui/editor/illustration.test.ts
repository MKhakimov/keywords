import { describe, expect, it } from 'vitest';
import { RU_ALPHABET } from '../../core/alphabet.ts';
import { parseRows } from '../../core/grid/rows.ts';
import { assemblePuzzle } from '../../core/puzzle/assemble.ts';
import { replaceIllustration } from './illustration.ts';

const puzzle = {
  ...assemblePuzzle({
    grid: parseRows(['ДОМ']),
    words: [{ word: 'ДОМ', row: 0, col: 0, dir: 'across' }],
    answerParts: [{ text: 'ДОМ', row: 0, col: 0, dir: 'across' }],
    letterOrder: ['Д', 'О', 'М'],
    meta: { id: 'a', title: '', theme: '', difficulty: 'medium', language: 'ru', alphabet: RU_ALPHABET.id, seed: 1, createdAt: '' },
    editorial: { rubric: '', heading: '', riddle: '', explanation: '', answer: 'дом' },
    illustration: { src: '/illustrations/placeholder.png', alt: 'шаблон', prompt: 'запрос', placeholder: true },
  }),
  validation: { valid: true, checks: [], issues: [] },
};

describe('replaceIllustration', () => {
  it('меняет только иллюстрацию', () => {
    const updated = replaceIllustration(puzzle, { src: 'data:image/png;base64,AAAA', placeholder: false, alt: 'кот' });
    expect(updated.illustration).toEqual({ src: 'data:image/png;base64,AAAA', alt: 'кот', prompt: 'запрос', placeholder: false });
    expect({ ...updated, illustration: puzzle.illustration }).toEqual(puzzle);
    expect(puzzle.illustration.src).toBe('/illustrations/placeholder.png');
  });
});
