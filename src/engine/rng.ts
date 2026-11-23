import type { Rng } from './types';

/**
 * Mulberry32 seeded PRNG (32-bit state). Returns a deterministic generator of floats in [0, 1).
 * The seed is coerced to an unsigned 32-bit integer.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Uniform random integer in [min, max] (both inclusive).
 * @throws if bounds are not integers or `min > max`.
 */
export function randInt(rng: Rng, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`Invalid range: [${min}, ${max}]`);
  }
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Uniformly picks one element of a non-empty array.
 * @throws if the array is empty.
 */
export function pick<T>(rng: Rng, array: readonly T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot pick from an empty array');
  }
  return array[randInt(rng, 0, array.length - 1)];
}

/** Returns a new array with the elements shuffled (Fisher–Yates). The input is not modified. */
export function shuffle<T>(rng: Rng, array: readonly T[]): T[] {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
