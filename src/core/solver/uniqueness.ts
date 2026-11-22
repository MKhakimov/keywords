import type { Alphabet } from '../alphabet.ts';
import { letterIndex } from '../alphabet.ts';
import type { Dictionary } from '../dictionary/dictionary.ts';
import { extractSlots } from '../grid/slots.ts';
import type { Direction } from '../grid/types.ts';
import type { UniquenessVerdict } from '../validate/validatePuzzle.ts';

export interface CipherGridInput {
  readonly width: number;
  readonly height: number;
  readonly numbers: readonly (number | null)[];
  readonly givens: Readonly<Record<number, string>>;
  readonly exemptSlots: readonly { row: number; col: number; dir: Direction; length: number }[];
}

export interface SolveOptions {
  readonly dictionary: Dictionary;
  readonly alphabet: Alphabet;
  readonly nodeBudget: number;
}

export interface SolveResult {
  readonly verdict: UniquenessVerdict;
  readonly solution?: Readonly<Record<number, string>>;
  readonly nodes: number;
}

const popcount = (v: number) => {
  let n = 0;
  for (let x = v >>> 0; x !== 0; x &= x - 1) n += 1;
  return n;
};
const lowestBit = (v: number) => 31 - Math.clz32(v & -v);

class BudgetExceeded extends Error {}

export function solveCipher(input: CipherGridInput, options: SolveOptions): SolveResult {
  const { dictionary, alphabet } = options;
  const toIndex = letterIndex(alphabet);
  const shape = { width: input.width, height: input.height };
  const exempt = new Set(input.exemptSlots.map((s) => `${s.row}:${s.col}:${s.dir}:${s.length}`));
  const slots = extractSlots(shape, (i) => input.numbers[i] !== null)
    .filter((slot) => !exempt.has(`${slot.row}:${slot.col}:${slot.dir}:${slot.length}`))
    .map((slot) => slot.cells.map((cell) => input.numbers[cell] as number));

  const numbers = [...new Set(input.numbers.filter((n): n is number => n !== null))].sort((a, b) => a - b);
  const maxNumber = Math.max(0, ...numbers);
  const slotsOf: number[][] = Array.from({ length: maxNumber + 1 }, () => []);
  slots.forEach((slot, id) => new Set(slot).forEach((n) => slotsOf[n]?.push(id)));

  const fullMask = alphabet.letters.length >= 32 ? 0xffffffff : (1 << alphabet.letters.length) - 1;
  let givenMask = 0;
  const initial = new Uint32Array(maxNumber + 1);
  for (const n of numbers) {
    const given = input.givens[n];
    if (given !== undefined) {
      const bit = 1 << (toIndex.get(given) ?? 0);
      initial[n] = bit >>> 0;
      givenMask |= bit;
    }
  }
  for (const n of numbers) if (input.givens[n] === undefined) initial[n] = (fullMask & ~givenMask) >>> 0;

  let nodes = 0;

  const slotSupport = (slot: readonly number[], domains: Uint32Array): Map<number, number> | null => {
    const pattern = slot.map((n) => {
      const d = domains[n] ?? 0;
      return popcount(d) === 1 ? (alphabet.letters[lowestBit(d)] ?? null) : null;
    });
    const support = new Map<number, number>();
    for (const n of slot) support.set(n, 0);
    const length = slot.length;
    for (const entry of dictionary.matches(pattern)) {
      const word = entry.word;
      const letterOfNumber = new Map<number, number>();
      const numberOfLetter = new Map<number, number>();
      let ok = true;
      for (let k = 0; k < length && ok; k += 1) {
        const n = slot[k] as number;
        const l = toIndex.get(word[k] as string) as number;
        if ((((domains[n] ?? 0) >>> l) & 1) === 0) ok = false;
        else if ((letterOfNumber.get(n) ?? l) !== l || (numberOfLetter.get(l) ?? n) !== n) ok = false;
        else {
          letterOfNumber.set(n, l);
          numberOfLetter.set(l, n);
        }
      }
      if (!ok) continue;
      for (const [n, l] of letterOfNumber) support.set(n, ((support.get(n) ?? 0) | (1 << l)) >>> 0);
    }
    for (const mask of support.values()) if (mask === 0) return null;
    return support;
  };

  const propagate = (domains: Uint32Array, queue: Set<number>): boolean => {
    while (queue.size > 0) {
      nodes += 1;
      if (nodes > options.nodeBudget) throw new BudgetExceeded();
      const [slotId] = queue;
      queue.delete(slotId as number);
      const slot = slots[slotId as number] as number[];
      const support = slotSupport(slot, domains);
      if (!support) return false;
      for (const [n, mask] of support) {
        const before = domains[n] ?? 0;
        const after = (before & mask) >>> 0;
        if (after === before) continue;
        if (after === 0) return false;
        domains[n] = after;
        for (const s of slotsOf[n] ?? []) queue.add(s);
        if (popcount(after) === 1) {
          for (const other of numbers) {
            if (other === n) continue;
            const d = domains[other] ?? 0;
            if ((d & after) === 0) continue;
            const reduced = (d & ~after) >>> 0;
            if (reduced === 0) return false;
            domains[other] = reduced;
            for (const s of slotsOf[other] ?? []) queue.add(s);
          }
        }
      }
    }
    return true;
  };

  const solutions: Record<number, string>[] = [];

  const search = (domains: Uint32Array): void => {
    if (solutions.length >= 2) return;
    let pick = -1;
    let best = Infinity;
    for (const n of numbers) {
      const size = popcount(domains[n] ?? 0);
      if (size > 1 && size < best) {
        best = size;
        pick = n;
      }
    }
    if (pick === -1) {
      const letters = new Set<number>();
      for (const n of numbers) letters.add(domains[n] ?? 0);
      if (letters.size !== numbers.length) return;
      solutions.push(Object.fromEntries(numbers.map((n) => [n, alphabet.letters[lowestBit(domains[n] ?? 0)] ?? '?'])));
      return;
    }
    let mask = domains[pick] ?? 0;
    while (mask !== 0 && solutions.length < 2) {
      const bit = (mask & -mask) >>> 0;
      mask = (mask & ~bit) >>> 0;
      const next = domains.slice();
      next[pick] = bit;
      const queue = new Set(slotsOf[pick] ?? []);
      for (const other of numbers) {
        if (other === pick || ((next[other] ?? 0) & bit) === 0) continue;
        next[other] = ((next[other] ?? 0) & ~bit) >>> 0;
        for (const s of slotsOf[other] ?? []) queue.add(s);
      }
      if (numbers.some((n) => (next[n] ?? 0) === 0)) continue;
      if (propagate(next, queue)) search(next);
    }
  };

  try {
    const domains = initial.slice();
    if (propagate(domains, new Set(slots.map((_, id) => id)))) search(domains);
  } catch (error) {
    if (error instanceof BudgetExceeded) return { verdict: 'timeout', nodes };
    throw error;
  }

  if (solutions.length === 0) return { verdict: 'unsolvable', nodes };
  if (solutions.length > 1) return { verdict: 'ambiguous', nodes };
  return { verdict: 'unique', solution: solutions[0] as Record<number, string>, nodes };
}
