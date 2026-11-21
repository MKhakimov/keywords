import type { Dictionary } from '../dictionary/dictionary.ts';
import { extractSlots } from '../grid/slots.ts';
import type { CellKind, GridShape, Slot } from '../grid/types.ts';
import type { Rng } from '../rng.ts';

export interface SlotFillInput {
  readonly shape: GridShape;
  readonly kinds: readonly CellKind[];
  readonly fixedLetters: readonly (string | null)[];
  readonly dictionary: Dictionary;
  readonly rng: Rng;
  readonly nodeBudget: number;
  readonly maxCandidates: number;
  readonly reservedWords: readonly string[];
}

export type SlotFillResult =
  | { readonly status: 'filled'; readonly letters: (string | null)[]; readonly nodes: number }
  | { readonly status: 'exhausted' | 'budget'; readonly nodes: number };

class BudgetExceeded extends Error {}

export function fillSlots(input: SlotFillInput): SlotFillResult {
  const { shape, kinds, dictionary, rng } = input;
  const letters: (string | null)[] = kinds.map((kind, i) => (kind === 'letter' ? (input.fixedLetters[i] ?? null) : null));
  const slots = extractSlots(shape, (i) => kinds[i] === 'letter');
  const crossings: number[][] = kinds.map(() => []);
  for (const slot of slots) for (const cell of slot.cells) crossings[cell]?.push(slot.id);

  const assigned = new Uint8Array(slots.length);
  const used = new Set(input.reservedWords);
  for (const slot of slots) {
    if (slot.cells.every((cell) => input.fixedLetters[cell])) assigned[slot.id] = 1;
  }

  const pattern = (slot: Slot) => slot.cells.map((cell) => letters[cell] ?? null);
  const counts = new Int32Array(slots.length);
  for (const slot of slots) if (!assigned[slot.id]) counts[slot.id] = dictionary.countMatches(pattern(slot));

  let nodes = 0;

  const pickSlot = (): Slot | null => {
    let best: Slot | null = null;
    let bestScore = Infinity;
    for (const slot of slots) {
      if (assigned[slot.id]) continue;
      const filled = slot.cells.reduce((n, cell) => n + (letters[cell] ? 1 : 0), 0);
      const score = (counts[slot.id] ?? 0) * 64 - filled * 4 + rng.next();
      if (score < bestScore) {
        bestScore = score;
        best = slot;
      }
    }
    return best;
  };

  const solve = (): boolean => {
    nodes += 1;
    if (nodes > input.nodeBudget) throw new BudgetExceeded();
    const slot = pickSlot();
    if (!slot) return true;
    if ((counts[slot.id] ?? 0) === 0) return false;

    const ranked = dictionary
      .matches(pattern(slot))
      .filter((entry) => !used.has(entry.word))
      .map((entry) => ({ word: entry.word, key: -Math.log(1 - rng.next()) / Math.log2(2 + entry.ipm) }))
      .sort((a, b) => a.key - b.key)
      .slice(0, input.maxCandidates);

    assigned[slot.id] = 1;
    for (const { word } of ranked) {
      const changed: number[] = [];
      slot.cells.forEach((cell, k) => {
        if (!letters[cell]) {
          letters[cell] = word[k] ?? null;
          changed.push(cell);
        }
      });
      used.add(word);

      const touched = new Map<number, number>();
      let ok = true;
      for (const cell of changed) {
        for (const other of crossings[cell] ?? []) {
          if (assigned[other] || touched.has(other)) continue;
          touched.set(other, counts[other] ?? 0);
          const count = dictionary.countMatches(pattern(slots[other] as Slot));
          counts[other] = count;
          if (count === 0) ok = false;
        }
        if (!ok) break;
      }

      if (ok && solve()) return true;

      for (const [other, count] of touched) counts[other] = count;
      used.delete(word);
      for (const cell of changed) letters[cell] = null;
    }
    assigned[slot.id] = 0;
    return false;
  };

  try {
    if (!solve()) return { status: 'exhausted', nodes };
  } catch (error) {
    if (error instanceof BudgetExceeded) return { status: 'budget', nodes };
    throw error;
  }
  return { status: 'filled', letters, nodes };
}
