export interface Rng {
  readonly seed: number;
  next(): number;
  int(maxExclusive: number): number;
  shuffle<T>(items: readonly T[]): T[];
  fork(salt: number): Rng;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`maxExclusive must be a positive integer, got ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };

  return {
    seed: seed >>> 0,
    next,
    int,
    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = int(i + 1);
        [result[i], result[j]] = [result[j] as T, result[i] as T];
      }
      return result;
    },
    fork(salt: number): Rng {
      return createRng(Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ salt);
    },
  };
}
