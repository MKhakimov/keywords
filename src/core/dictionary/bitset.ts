export type Bitset = Uint32Array;

export function createBitset(size: number, filled = false): Bitset {
  const words = Math.ceil(size / 32);
  const bits = new Uint32Array(words);
  if (filled && size > 0) {
    bits.fill(0xffffffff);
    const tail = size % 32;
    if (tail !== 0) bits[words - 1] = (1 << tail) - 1;
  }
  return bits;
}

export function setBit(bits: Bitset, index: number): void {
  const word = index >>> 5;
  bits[word] = (bits[word] ?? 0) | (1 << (index & 31));
}

export function hasBit(bits: Bitset, index: number): boolean {
  return (((bits[index >>> 5] ?? 0) >>> (index & 31)) & 1) === 1;
}

export function andInto(target: Bitset, source: Bitset): void {
  for (let i = 0; i < target.length; i += 1) target[i] = (target[i] ?? 0) & (source[i] ?? 0);
}

export function popcount(bits: Bitset): number {
  let count = 0;
  for (let i = 0; i < bits.length; i += 1) {
    let v = bits[i] ?? 0;
    v -= (v >>> 1) & 0x55555555;
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    count += (Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24);
  }
  return count;
}

export function* iterateBits(bits: Bitset): Generator<number> {
  for (let i = 0; i < bits.length; i += 1) {
    let v = bits[i] ?? 0;
    while (v !== 0) {
      const low = v & -v;
      yield i * 32 + (31 - Math.clz32(low));
      v ^= low;
    }
  }
}
