import type { Alphabet } from '../../core/alphabet.ts';
import { normalizeWord } from '../../core/alphabet.ts';
import type { Direction } from '../../core/grid/types.ts';
import type { PlayView } from '../../core/puzzle/views.ts';

export interface CheckResult {
  readonly wrong: readonly number[];
  readonly missing: number;
  readonly solved: boolean;
}

export interface GameState {
  readonly entries: Readonly<Record<number, string>>;
  readonly selected: number | null;
  readonly direction: Direction;
  readonly check: CheckResult | null;
  readonly solved: boolean;
}

export type GameAction =
  | { readonly type: 'select'; readonly index: number }
  | { readonly type: 'input'; readonly letter: string }
  | { readonly type: 'erase' }
  | { readonly type: 'move'; readonly dRow: number; readonly dCol: number }
  | { readonly type: 'checked'; readonly result: CheckResult }
  | { readonly type: 'reset' };

export function givenEntries(view: PlayView): Record<number, string> {
  return Object.fromEntries(view.key.filter((k) => k.letter !== null).map((k) => [k.number, k.letter as string]));
}

export function initialGameState(
  view: PlayView,
  saved: Readonly<Record<number, string>> = {},
  solved = false,
): GameState {
  const givens = givenEntries(view);
  const givenLetters = new Set(Object.values(givens));
  const numbers = new Set(view.key.map((k) => k.number));
  const usedLetters = new Set<string>();
  const entries: Record<number, string> = {};
  for (const [key, letter] of Object.entries(saved)) {
    const number = Number(key);
    if (!numbers.has(number) || givens[number] !== undefined) continue;
    if (typeof letter !== 'string' || letter.length !== 1 || givenLetters.has(letter) || usedLetters.has(letter)) continue;
    usedLetters.add(letter);
    entries[number] = letter;
  }
  return { entries: { ...entries, ...givens }, selected: null, direction: 'across', check: null, solved };
}

export function createGameReducer(view: PlayView, alphabet: Alphabet) {
  const { width, height, cells } = view.grid;
  const givens = givenEntries(view);
  const givenLetters = new Set(Object.values(givens));
  const isLetter = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < height && c < width && cells[r * width + c]?.kind === 'letter';
  const numberAt = (index: number) => {
    const cell = cells[index];
    return cell?.kind === 'letter' ? cell.number : null;
  };

  const step = (index: number, dRow: number, dCol: number): number | null => {
    const r = Math.floor(index / width) + dRow;
    const c = (index % width) + dCol;
    return isLetter(r, c) ? r * width + c : null;
  };

  const jump = (index: number, dRow: number, dCol: number): number | null => {
    let r = Math.floor(index / width) + dRow;
    let c = (index % width) + dCol;
    while (r >= 0 && c >= 0 && r < height && c < width) {
      if (isLetter(r, c)) return r * width + c;
      r += dRow;
      c += dCol;
    }
    return null;
  };

  const preferredDirection = (index: number, current: Direction): Direction => {
    const r = Math.floor(index / width);
    const c = index % width;
    const across = isLetter(r, c - 1) || isLetter(r, c + 1);
    const down = isLetter(r - 1, c) || isLetter(r + 1, c);
    if (across && down) return current;
    return down ? 'down' : 'across';
  };

  const delta = (direction: Direction): [number, number] => (direction === 'across' ? [0, 1] : [1, 0]);

  return (state: GameState, action: GameAction): GameState => {
    switch (action.type) {
      case 'select': {
        if (numberAt(action.index) === null) return state;
        if (state.selected === action.index) {
          const toggled: Direction = state.direction === 'across' ? 'down' : 'across';
          return { ...state, direction: preferredDirection(action.index, toggled) === toggled ? toggled : state.direction };
        }
        return { ...state, selected: action.index, direction: preferredDirection(action.index, state.direction) };
      }
      case 'input': {
        if (state.selected === null) return state;
        const number = numberAt(state.selected);
        const letter = normalizeWord(action.letter, alphabet);
        if (number === null || letter === null || letter.length !== 1) return state;
        const [dRow, dCol] = delta(state.direction);
        const next = step(state.selected, dRow, dCol) ?? state.selected;
        if (givens[number] !== undefined) return { ...state, selected: next };
        if (givenLetters.has(letter)) return state;
        const entries: Record<number, string> = {};
        for (const [key, value] of Object.entries(state.entries)) if (value !== letter) entries[Number(key)] = value;
        entries[number] = letter;
        return { ...state, entries, selected: next, check: null, solved: false };
      }
      case 'erase': {
        if (state.selected === null) return state;
        const remove = (index: number): GameState | null => {
          const number = numberAt(index);
          if (number === null || givens[number] !== undefined || state.entries[number] === undefined) return null;
          const entries = { ...state.entries };
          delete entries[number];
          return { ...state, entries, selected: index, check: null, solved: false };
        };
        const here = remove(state.selected);
        if (here) return here;
        const [dRow, dCol] = delta(state.direction);
        const previous = step(state.selected, -dRow, -dCol);
        if (previous === null) return state;
        return remove(previous) ?? { ...state, selected: previous };
      }
      case 'move': {
        const direction: Direction = action.dRow !== 0 ? 'down' : 'across';
        if (state.selected === null) {
          const first = cells.findIndex((cell) => cell.kind === 'letter');
          return first < 0 ? state : { ...state, selected: first, direction };
        }
        const target = jump(state.selected, action.dRow, action.dCol);
        return { ...state, selected: target ?? state.selected, direction };
      }
      case 'checked':
        return { ...state, check: action.result, solved: action.result.solved };
      case 'reset':
        return initialGameState(view);
    }
  };
}
