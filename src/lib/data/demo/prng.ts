/** Small deterministic PRNG helpers so sample data is stable between renders and in tests. */

/** Hashes a string to a 32-bit unsigned integer seed (FNV-1a). */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  float(min: number, max: number): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Log-normal sample with the given median and shape (sigma); always positive. */
  logNormal(median: number, sigma: number): number;
}

/** mulberry32: tiny, fast, good enough for fixtures. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)] as (typeof items)[number],
    logNormal: (median, sigma) => {
      // Box–Muller transform for a standard normal sample.
      const u1 = Math.max(next(), Number.EPSILON);
      const u2 = next();
      const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return median * Math.exp(sigma * normal);
    },
  };
  return rng;
}
