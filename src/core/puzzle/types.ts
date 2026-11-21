import type { Direction } from '../grid/types.ts';
import type { ValidationReport } from '../validate/report.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface VoidCell {
  readonly kind: 'void';
}

export interface BlockCell {
  readonly kind: 'block';
}

export interface LetterCell {
  readonly kind: 'letter';
  readonly letter: string;
  readonly number: number;
  readonly given: boolean;
  readonly answerPart?: number;
}

export type PuzzleCell = VoidCell | BlockCell | LetterCell;

export interface PlacedWord {
  readonly word: string;
  readonly row: number;
  readonly col: number;
  readonly dir: Direction;
}

export interface AnswerPart {
  readonly order: number;
  readonly text: string;
  readonly row: number;
  readonly col: number;
  readonly dir: Direction;
}

export interface CipherEntry {
  readonly number: number;
  readonly letter: string;
}

export interface Puzzle {
  readonly schemaVersion: 1;
  readonly meta: {
    readonly id: string;
    readonly title: string;
    readonly theme: string;
    readonly difficulty: Difficulty;
    readonly language: 'ru';
    readonly alphabet: string;
    readonly seed: number;
    readonly createdAt: string;
  };
  readonly editorial: {
    readonly rubric: string;
    readonly heading: string;
    readonly riddle: string;
    readonly explanation: string;
    readonly answer: string;
  };
  readonly illustration: {
    readonly src: string;
    readonly alt: string;
    readonly prompt: string;
    readonly placeholder: boolean;
  };
  readonly grid: {
    readonly width: number;
    readonly height: number;
    readonly cells: readonly PuzzleCell[];
  };
  readonly words: readonly PlacedWord[];
  readonly answerParts: readonly AnswerPart[];
  readonly cipher: readonly CipherEntry[];
  readonly givens: readonly number[];
  readonly validation?: ValidationReport;
}
