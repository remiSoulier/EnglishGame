import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randInt, shuffle } from './rng';
import type { Rng } from './types';

const take = (rng: Rng, n: number): number[] => Array.from({ length: n }, () => rng());

describe('mulberry32', { timeout: 30_000 }, () => {
  it('matches the reference first value for seed 1', () => {
    expect(mulberry32(1)()).toBe(0.6270739405881613);
  });

  it('is deterministic for a given seed', () => {
    for (const seed of [0, 1, 42, 123456789, 0xffffffff]) {
      expect(take(mulberry32(seed), 100)).toEqual(take(mulberry32(seed), 100));
    }
  });

  it('differs between seeds', () => {
    expect(take(mulberry32(1), 10)).not.toEqual(take(mulberry32(2), 10));
  });

  it('coerces the seed to uint32', () => {
    expect(take(mulberry32(-1), 5)).toEqual(take(mulberry32(0xffffffff), 5));
    expect(take(mulberry32(2 ** 32 + 7), 5)).toEqual(take(mulberry32(7), 5));
  });

  it('produces values in [0, 1)', () => {
    for (const seed of [0, 1, 99]) {
      for (const v of take(mulberry32(seed), 10_000)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('roughly averages 0.5 and is not constant', () => {
    const values = take(mulberry32(7), 10_000);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
    expect(new Set(values).size).toBeGreaterThan(9_990);
  });
});

describe('randInt', { timeout: 30_000 }, () => {
  it('stays within inclusive bounds and covers every value over 10 000 draws', () => {
    const rng = mulberry32(2024);
    const counts = new Map<number, number>();
    for (let i = 0; i < 10_000; i++) {
      const v = randInt(rng, 1, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    // Expected ≈ 1667 each; allow a generous ±15 %.
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(1417);
      expect(n).toBeLessThan(1917);
    }
  });

  it('hits both bounds for the board range 0–8', () => {
    const rng = mulberry32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) seen.add(randInt(rng, 0, 8));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('supports negative ranges and min === max', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 1000; i++) {
      const v = randInt(rng, -3, -1);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(-1);
    }
    expect(randInt(rng, 4, 4)).toBe(4);
  });

  it('maps rng extremes onto the bounds', () => {
    expect(randInt(() => 0, 2, 7)).toBe(2);
    expect(randInt(() => 0.9999999999, 2, 7)).toBe(7);
  });

  it('is deterministic per seed', () => {
    const a = mulberry32(11);
    const b = mulberry32(11);
    for (let i = 0; i < 100; i++) expect(randInt(a, 0, 100)).toBe(randInt(b, 0, 100));
  });

  it.each([
    [5, 4],
    [0.5, 3],
    [0, 2.5],
    [Number.NaN, 3],
  ])('throws for invalid range [%s, %s]', (min, max) => {
    expect(() => randInt(mulberry32(1), min, max)).toThrow();
  });
});

describe('pick', () => {
  it('returns an element of the array and eventually all of them', () => {
    const rng = mulberry32(8);
    const items = ['a', 'b', 'c', 'd'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const v = pick(rng, items);
      expect(items).toContain(v);
      seen.add(v);
    }
    expect(seen.size).toBe(4);
  });

  it('returns the only element of a singleton', () => {
    expect(pick(mulberry32(1), [42])).toBe(42);
  });

  it('is deterministic per seed', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const a = mulberry32(9);
    const b = mulberry32(9);
    for (let i = 0; i < 50; i++) expect(pick(a, items)).toBe(pick(b, items));
  });

  it('throws on an empty array', () => {
    expect(() => pick(mulberry32(1), [])).toThrow();
  });
});

describe('shuffle', () => {
  const input = Array.from({ length: 20 }, (_, i) => i);

  it('returns a permutation of the input', () => {
    const out = shuffle(mulberry32(1), input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input and returns a new array', () => {
    const copy = input.slice();
    const out = shuffle(mulberry32(1), input);
    expect(input).toEqual(copy);
    expect(out).not.toBe(input);
  });

  it('works on frozen arrays', () => {
    const frozen = Object.freeze(['x', 'y', 'z']);
    expect([...shuffle(mulberry32(2), frozen)].sort()).toEqual(['x', 'y', 'z']);
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(shuffle(mulberry32(77), input)).toEqual(shuffle(mulberry32(77), input));
    expect(shuffle(mulberry32(77), input)).not.toEqual(shuffle(mulberry32(78), input));
  });

  it('actually reorders a sizeable array', () => {
    expect(shuffle(mulberry32(3), input)).not.toEqual(input);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle(mulberry32(1), [])).toEqual([]);
    expect(shuffle(mulberry32(1), ['only'])).toEqual(['only']);
  });

  it('produces every permutation of 3 elements', () => {
    const rng = mulberry32(10);
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) seen.add(shuffle(rng, [1, 2, 3]).join(''));
    expect(seen.size).toBe(6);
  });
});
