import type { Alphabet } from '../alphabet.ts';
import { normalizeAnswer } from '../alphabet.ts';
import type { Dictionary } from '../dictionary/dictionary.ts';
import { extractSlots, letterComponents, slotCells, toCoord } from '../grid/slots.ts';
import type { Coord, Direction, Slot } from '../grid/types.ts';
import type { LetterCell, Puzzle } from '../puzzle/types.ts';
import type { CheckId, CheckResult, Issue, ValidationReport } from './report.ts';
import { CHECKS } from './report.ts';

export type UniquenessVerdict = 'unique' | 'ambiguous' | 'unsolvable' | 'timeout';

export interface ValidateOptions {
  readonly dictionary: Dictionary;
  readonly alphabet: Alphabet;
  readonly minNumberOccurrences?: number;
  readonly checkUniqueness?: (puzzle: Puzzle) => UniquenessVerdict;
}

const slotKey = (row: number, col: number, dir: Direction, length: number) => `${row}:${col}:${dir}:${length}`;

export function validatePuzzle(puzzle: Puzzle, options: ValidateOptions): ValidationReport {
  const issues: Issue[] = [];
  const failed = new Set<CheckId>();
  const skipped = new Set<CheckId>();
  const fail = (check: CheckId, message: string, cells?: Coord[]) => {
    failed.add(check);
    issues.push(cells ? { check, message, cells } : { check, message });
  };

  const { width, height, cells } = puzzle.grid;
  const shape = { width, height };
  const finish = (): ValidationReport => {
    const checks: CheckResult[] = (Object.keys(CHECKS) as CheckId[]).map((id) => ({
      id,
      title: CHECKS[id],
      status: failed.has(id) ? 'failed' : skipped.has(id) ? 'skipped' : 'passed',
    }));
    return { valid: checks.every((c) => c.status === 'passed'), checks, issues };
  };

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || cells.length !== width * height) {
    fail('grid-shape', `Ожидалось ${width}×${height} клеток, получено ${cells.length}`);
    (Object.keys(CHECKS) as CheckId[]).filter((id) => id !== 'grid-shape').forEach((id) => skipped.add(id));
    return finish();
  }

  const letterAt = (index: number): LetterCell | undefined => {
    const cell = cells[index];
    return cell?.kind === 'letter' ? cell : undefined;
  };
  const isLetter = (index: number) => letterAt(index) !== undefined;
  const coord = (index: number) => toCoord(shape, index);
  const letterIndices = cells.flatMap((cell, index) => (cell.kind === 'letter' ? [index] : []));

  const alphabetLetters = new Set(options.alphabet.letters);
  for (const index of letterIndices) {
    const cell = letterAt(index) as LetterCell;
    if (!alphabetLetters.has(cell.letter)) {
      fail('letters-in-alphabet', `Буква «${cell.letter}» не входит в алфавит ${options.alphabet.id}`, [coord(index)]);
    }
  }

  const slots = extractSlots(shape, isLetter);
  const covered = new Set(slots.flatMap((slot) => slot.cells));
  const unreadable = letterIndices.filter((index) => !covered.has(index));
  if (unreadable.length > 0) {
    fail('cells-readable', 'Есть буквенные клетки вне слов', unreadable.map(coord));
  }

  const components = letterComponents(shape, isLetter);
  if (components.length !== 1) {
    fail('connected', components.length === 0 ? 'В сетке нет буквенных клеток' : `Сетка распадается на ${components.length} части`);
  }

  const readSlot = (slot: Slot) => slot.cells.map((index) => letterAt(index)?.letter ?? '?').join('');
  const answerParts = [...puzzle.answerParts].sort((a, b) => a.order - b.order);
  const answerSlotKeys = new Map(answerParts.map((p) => [slotKey(p.row, p.col, p.dir, p.text.length), p]));

  for (const slot of slots) {
    const word = readSlot(slot);
    const answerPart = answerSlotKeys.get(slotKey(slot.row, slot.col, slot.dir, slot.length));
    const isAnswer = answerPart !== undefined && answerPart.text === word;
    if (!isAnswer && !options.dictionary.has(word)) {
      fail('slots-are-words', `«${word}» нет в словаре`, slot.cells.map(coord));
    }
  }

  const wordsByKey = new Map<string, number>();
  const seenWords = new Map<string, number>();
  for (const placed of puzzle.words) {
    const indices = slotCells(shape, placed.row, placed.col, placed.dir, placed.word.length);
    const inBounds =
      placed.row >= 0 &&
      placed.col >= 0 &&
      (placed.dir === 'across'
        ? placed.row < height && placed.col + placed.word.length <= width
        : placed.col < width && placed.row + placed.word.length <= height);
    const actual = inBounds ? indices.map((index) => letterAt(index)?.letter ?? '?').join('') : null;
    if (actual !== placed.word) {
      fail(
        'words-match-grid',
        `Слово «${placed.word}» (${placed.row}, ${placed.col}, ${placed.dir}) не совпадает с сеткой: «${actual ?? 'вне сетки'}»`,
        inBounds ? indices.map(coord) : undefined,
      );
    }
    const key = slotKey(placed.row, placed.col, placed.dir, placed.word.length);
    wordsByKey.set(key, (wordsByKey.get(key) ?? 0) + 1);
    seenWords.set(placed.word, (seenWords.get(placed.word) ?? 0) + 1);
  }

  const slotKeys = new Set(slots.map((s) => slotKey(s.row, s.col, s.dir, s.length)));
  for (const slot of slots) {
    const count = wordsByKey.get(slotKey(slot.row, slot.col, slot.dir, slot.length)) ?? 0;
    if (count !== 1) {
      fail('words-cover-slots', `Цепочке «${readSlot(slot)}» соответствует слов: ${count}`, slot.cells.map(coord));
    }
  }
  for (const [key] of wordsByKey) {
    if (!slotKeys.has(key)) fail('words-cover-slots', `Слово по координатам ${key} не является полной цепочкой сетки`);
  }

  for (const [word, count] of seenWords) {
    if (count > 1) fail('no-duplicate-words', `Слово «${word}» встречается ${count} раза`);
  }

  const numberToLetter = new Map<number, string>();
  const letterToNumber = new Map<string, number>();
  for (const entry of puzzle.cipher) {
    if (numberToLetter.has(entry.number)) fail('cipher-bijective', `Номер ${entry.number} встречается в шифре дважды`);
    if (letterToNumber.has(entry.letter)) fail('cipher-bijective', `Буква «${entry.letter}» встречается в шифре дважды`);
    numberToLetter.set(entry.number, entry.letter);
    letterToNumber.set(entry.letter, entry.number);
  }

  const occurrences = new Map<number, number>();
  for (const index of letterIndices) {
    const cell = letterAt(index) as LetterCell;
    occurrences.set(cell.number, (occurrences.get(cell.number) ?? 0) + 1);
    const expected = numberToLetter.get(cell.number);
    if (expected !== cell.letter) {
      fail(
        'cipher-matches-cells',
        expected === undefined
          ? `Номера ${cell.number} нет в шифре`
          : `Клетка с номером ${cell.number} содержит «${cell.letter}», а в шифре «${expected}»`,
        [coord(index)],
      );
    }
  }
  for (const entry of puzzle.cipher) {
    if (!occurrences.has(entry.number)) fail('cipher-matches-cells', `Номер ${entry.number} есть в шифре, но не используется в сетке`);
  }

  const numbers = [...numberToLetter.keys()].sort((a, b) => a - b);
  if (numbers.some((n, i) => n !== i + 1)) {
    fail('cipher-contiguous', `Номера шифра должны идти 1…${numbers.length}`);
  }

  const minOccurrences = options.minNumberOccurrences ?? 2;
  for (const [number, count] of occurrences) {
    if (count < minOccurrences) fail('numbers-repeat', `Номер ${number} встречается ${count} раз(а), нужно не меньше ${minOccurrences}`);
  }

  const expectedParts = normalizeAnswer(puzzle.editorial.answer, options.alphabet);
  if (expectedParts === null || answerParts.length === 0) {
    fail('answer-present', 'Ответ пустой или содержит недопустимые символы');
  } else {
    if (answerParts.some((part, i) => part.order !== i + 1)) {
      fail('answer-present', 'Части ответа должны быть пронумерованы 1…N');
    }
    if (expectedParts.join(' ') !== answerParts.map((p) => p.text).join(' ')) {
      fail('answer-present', `Части ответа «${answerParts.map((p) => p.text).join(' ')}» не совпадают с ответом «${expectedParts.join(' ')}»`);
    }
    const answerCells = new Map<number, number>();
    for (const part of answerParts) {
      const key = slotKey(part.row, part.col, part.dir, part.text.length);
      const slot = slots.find((s) => slotKey(s.row, s.col, s.dir, s.length) === key);
      if (!slot) {
        fail('answer-present', `Часть ответа «${part.text}» не занимает целую цепочку сетки`);
        continue;
      }
      if (readSlot(slot) !== part.text) {
        fail('answer-present', `Часть ответа «${part.text}» не совпадает с клетками «${readSlot(slot)}»`, slot.cells.map(coord));
      }
      slot.cells.forEach((index) => answerCells.set(index, part.order));
    }
    for (const index of letterIndices) {
      const flag = (letterAt(index) as LetterCell).answerPart;
      if (flag !== answerCells.get(index)) {
        fail('answer-present', 'Подсветка клеток ответа не совпадает с размещением частей', [coord(index)]);
      }
    }
  }

  const givens = new Set(puzzle.givens);
  if (givens.size !== puzzle.givens.length) fail('givens-valid', 'Стартовые номера повторяются');
  for (const number of givens) {
    if (!numberToLetter.has(number)) fail('givens-valid', `Стартового номера ${number} нет в шифре`);
  }
  const givenNumbersInGrid = new Set<number>();
  for (const index of letterIndices) {
    const cell = letterAt(index) as LetterCell;
    if (!cell.given) continue;
    givenNumbersInGrid.add(cell.number);
    if (!givens.has(cell.number)) fail('givens-valid', `Клетка с номером ${cell.number} открыта, но номера нет в подсказках`, [coord(index)]);
  }
  for (const number of givens) {
    if (!givenNumbersInGrid.has(number)) fail('givens-valid', `Стартовый номер ${number} не открыт ни в одной клетке`);
  }

  if (!options.checkUniqueness) {
    skipped.add('unique-solution');
  } else if (failed.size === 0) {
    const verdict = options.checkUniqueness(puzzle);
    if (verdict !== 'unique') {
      const messages: Record<Exclude<UniquenessVerdict, 'unique'>, string> = {
        ambiguous: 'Сетка допускает больше одной расшифровки',
        unsolvable: 'Решатель не нашёл ни одной расшифровки',
        timeout: 'Решатель не уложился в лимит времени',
      };
      fail('unique-solution', messages[verdict]);
    }
  } else {
    skipped.add('unique-solution');
  }

  return finish();
}
