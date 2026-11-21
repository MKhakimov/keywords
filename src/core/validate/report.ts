import type { Coord } from '../grid/types.ts';

export const CHECKS = {
  'grid-shape': 'Размеры сетки и массив клеток согласованы',
  'letters-in-alphabet': 'Все буквы принадлежат выбранному алфавиту',
  'cells-readable': 'Каждая буквенная клетка входит хотя бы в одно слово',
  connected: 'Все буквенные клетки связаны в одну область',
  'slots-are-words': 'Каждая цепочка из 2+ букв — слово из словаря или часть ответа',
  'words-match-grid': 'Список слов совпадает с клетками сетки',
  'words-cover-slots': 'Каждой цепочке соответствует ровно одно слово из списка',
  'no-duplicate-words': 'Слова в сетке не повторяются',
  'cipher-bijective': 'Одна буква — один номер, один номер — одна буква',
  'cipher-matches-cells': 'Номера клеток согласованы с таблицей шифра',
  'cipher-contiguous': 'Номера идут подряд от 1 до K',
  'numbers-repeat': 'Каждый номер встречается в сетке несколько раз',
  'answer-present': 'Ответ на загадку размещён в сетке по частям',
  'givens-valid': 'Стартовые подсказки согласованы с сеткой и ключом',
  'unique-solution': 'Расшифровка единственна',
} as const;

export type CheckId = keyof typeof CHECKS;

export type CheckStatus = 'passed' | 'failed' | 'skipped';

export interface Issue {
  readonly check: CheckId;
  readonly message: string;
  readonly cells?: readonly Coord[];
}

export interface CheckResult {
  readonly id: CheckId;
  readonly title: string;
  readonly status: CheckStatus;
}

export interface ValidationReport {
  readonly valid: boolean;
  readonly checks: readonly CheckResult[];
  readonly issues: readonly Issue[];
}
