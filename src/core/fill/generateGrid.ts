import type { Dictionary } from '../dictionary/dictionary.ts';
import type { LetterGrid } from '../grid/rows.ts';
import { extractSlots } from '../grid/slots.ts';
import type { PlacedWord } from '../puzzle/types.ts';
import { createRng } from '../rng.ts';
import { fillSlots } from './fillSlots.ts';
import type { AnswerPlacement, Rect } from './layout.ts';
import { LayoutError, planLayout } from './layout.ts';
import { generateTemplate } from './template.ts';

export interface GridConfig {
  readonly width: number;
  readonly height: number;
  readonly voids: readonly Rect[];
  readonly answerColumn: number;
  readonly answerParts: readonly string[];
  readonly minWordLength: number;
  readonly maxWordLength: number;
  readonly extraBreakChance: number;
  readonly densifyChance: number;
  readonly nodeBudget: number;
  readonly maxCandidates: number;
  readonly maxAttempts: number;
  readonly seed: number;
}

export const DEFAULT_GRID_CONFIG: Omit<GridConfig, 'answerParts' | 'seed'> = {
  width: 18,
  height: 19,
  voids: [{ row: 0, col: 0, width: 7, height: 5 }],
  answerColumn: 16,
  minWordLength: 3,
  maxWordLength: 8,
  extraBreakChance: 0.35,
  densifyChance: 0.6,
  nodeBudget: 4_000,
  maxCandidates: 60,
  maxAttempts: 60,
};

export interface GridStats {
  readonly attempts: number;
  readonly nodes: number;
  readonly blockRatio: number;
  readonly words: number;
}

export type GridResult =
  | {
      readonly status: 'ok';
      readonly grid: LetterGrid;
      readonly words: readonly PlacedWord[];
      readonly answer: readonly AnswerPlacement[];
      readonly stats: GridStats;
    }
  | { readonly status: 'failed'; readonly reason: string; readonly stats: Pick<GridStats, 'attempts' | 'nodes'> };

export function generateGrid(config: GridConfig, dictionary: Dictionary): GridResult {
  const rng = createRng(config.seed);
  const fillDictionary = dictionary.filter({ minLength: config.minWordLength, maxLength: config.maxWordLength });
  let totalNodes = 0;
  const reasons = new Map<string, number>();
  const note = (reason: string) => reasons.set(reason, (reasons.get(reason) ?? 0) + 1);

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    const attemptRng = rng.fork(attempt);
    let layout;
    try {
      layout = planLayout({
        width: config.width,
        height: config.height,
        voids: config.voids,
        answerColumn: config.answerColumn,
        answerParts: config.answerParts,
        rng: attemptRng,
      });
    } catch (error) {
      if (error instanceof LayoutError) {
        return { status: 'failed', reason: error.message, stats: { attempts: attempt, nodes: totalNodes } };
      }
      throw error;
    }

    const kinds = generateTemplate(
      layout,
      { minWordLength: config.minWordLength, maxWordLength: config.maxWordLength, extraBreakChance: config.extraBreakChance, densifyChance: config.densifyChance },
      attemptRng,
    );
    if (!kinds) {
      note('шаблон');
      continue;
    }

    const fixedLetters = layout.fixed.map((cell) => (cell?.kind === 'letter' ? cell.letter : null));
    const result = fillSlots({
      shape: layout,
      kinds,
      fixedLetters,
      dictionary: fillDictionary,
      rng: attemptRng,
      nodeBudget: config.nodeBudget,
      maxCandidates: config.maxCandidates,
      reservedWords: config.answerParts,
    });
    totalNodes += result.nodes;
    if (result.status !== 'filled') {
      note(result.status === 'budget' ? 'лимит перебора' : 'перебор исчерпан');
      continue;
    }

    const grid: LetterGrid = { width: config.width, height: config.height, kinds, letters: result.letters };
    const words: PlacedWord[] = extractSlots(grid, (i) => kinds[i] === 'letter').map((slot) => ({
      word: slot.cells.map((i) => result.letters[i] ?? '?').join(''),
      row: slot.row,
      col: slot.col,
      dir: slot.dir,
    }));
    const free = layout.fixed.filter((cell) => cell === null).length;
    const blocks = kinds.filter((k, i) => k === 'block' && layout.fixed[i] === null).length;
    return {
      status: 'ok',
      grid,
      words,
      answer: layout.answer,
      stats: { attempts: attempt, nodes: totalNodes, blockRatio: blocks / free, words: words.length },
    };
  }

  const summary = [...reasons.entries()].map(([reason, n]) => `${reason}: ${n}`).join(', ');
  return {
    status: 'failed',
    reason: `Не удалось построить сетку за ${config.maxAttempts} попыток (${summary})`,
    stats: { attempts: config.maxAttempts, nodes: totalNodes },
  };
}
