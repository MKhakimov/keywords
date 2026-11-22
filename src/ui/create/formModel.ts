import type { GridConfig } from '../../core/fill/generateGrid.ts';
import type { PuzzleRequest } from '../../core/puzzle/generatePuzzle.ts';
import type { Difficulty } from '../../core/puzzle/types.ts';

export interface PuzzleFormValues {
  rubric: string;
  heading: string;
  riddle: string;
  explanation: string;
  answer: string;
  theme: string;
  difficulty: Difficulty;
  width: number;
  height: number;
  seed: number;
  illustrationSrc: string;
  illustrationAlt: string;
  illustrationPlaceholder: boolean;
}

export const GRID_LIMITS = { minWidth: 12, maxWidth: 24, minHeight: 12, maxHeight: 26 } as const;

export const PLACEHOLDER_ILLUSTRATION = `${import.meta.env.BASE_URL}illustrations/placeholder.png`;

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

export function defaultFormValues(): PuzzleFormValues {
  return {
    rubric: 'Народная мудрость',
    heading: 'В тихом … черти водятся',
    riddle: 'Какое слово пропущено в пословице?',
    explanation:
      'Так говорят о человеке, который кажется спокойным и незаметным, но способен всерьёз удивить окружающих.',
    answer: 'омуте',
    theme: 'пословицы',
    difficulty: 'medium',
    width: 18,
    height: 19,
    seed: randomSeed(),
    illustrationSrc: PLACEHOLDER_ILLUSTRATION,
    illustrationAlt: 'Иллюстрация-заглушка: двое беседуют в комнате',
    illustrationPlaceholder: true,
  };
}

export function gridForSize(width: number, height: number): Pick<GridConfig, 'width' | 'height' | 'voids' | 'answerColumn'> {
  const voidWidth = Math.max(4, Math.round(width * 0.39));
  const voidHeight = Math.max(3, Math.round(height * 0.26));
  const answerColumn = (width - 2) % 2 === 0 ? width - 2 : width - 3;
  return { width, height, voids: [{ row: 0, col: 0, width: voidWidth, height: voidHeight }], answerColumn };
}

export function validateForm(values: PuzzleFormValues): Partial<Record<keyof PuzzleFormValues, string>> {
  const errors: Partial<Record<keyof PuzzleFormValues, string>> = {};
  if (!values.answer.trim()) errors.answer = 'Укажите ответ';
  if (!values.heading.trim()) errors.heading = 'Укажите заголовок';
  const { minWidth, maxWidth, minHeight, maxHeight } = GRID_LIMITS;
  if (!Number.isInteger(values.width) || values.width < minWidth || values.width > maxWidth) {
    errors.width = `Ширина от ${minWidth} до ${maxWidth}`;
  }
  if (!Number.isInteger(values.height) || values.height < minHeight || values.height > maxHeight) {
    errors.height = `Высота от ${minHeight} до ${maxHeight}`;
  }
  if (!Number.isInteger(values.seed) || values.seed < 0) errors.seed = 'Seed — целое неотрицательное число';
  return errors;
}

export function buildRequest(values: PuzzleFormValues): PuzzleRequest {
  return {
    id: crypto.randomUUID(),
    title: values.heading.trim(),
    theme: values.theme.trim(),
    difficulty: values.difficulty,
    seed: values.seed,
    createdAt: new Date().toISOString(),
    editorial: {
      rubric: values.rubric.trim(),
      heading: values.heading.trim(),
      riddle: values.riddle.trim(),
      explanation: values.explanation.trim(),
      answer: values.answer.trim(),
    },
    illustration: {
      src: values.illustrationSrc,
      alt: values.illustrationAlt.trim(),
      prompt: '',
      placeholder: values.illustrationPlaceholder,
    },
    grid: gridForSize(values.width, values.height),
  };
}
