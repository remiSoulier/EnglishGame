import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  codeToSeed,
  isValidCode,
  newCode,
  normalizeCode,
  parseCode,
  rngFor,
  turnSeed,
} from './boardCode';
import { placeConnectedWalls } from './connectivity';
import { mulberry32 } from './rng';

const CODE_RE = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{3}$/;
const EXPECTED_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH_ERROR = 'Code must have 7 characters';
const CHARS_ERROR = 'Code contains invalid characters';

/** Walls of K7F2-9QX turn 1, pinned so that any change to the draw is noticed. */
const PINNED_WALLS_K7F2_9QX_T1 =
  '[{"sides":["G4-S","H4-S"]},{"sides":["C2-E","C3-E","C4-E","C5-E"]},' +
  '{"sides":["G5-E","G4-E","H3-S","I3-S"]},{"sides":["A6-S","B6-S"]},' +
  '{"sides":["H1-E","H1-S"]},{"sides":["D2-S","C2-S","B2-S"]},' +
  '{"sides":["D5-E","E5-S","F5-S"]},{"sides":["B4-S","A4-S"]}]';

const isUint32 = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;

/**
 * Independent re-implementation of the documented hash: 32-bit FNV-1a over UTF-16 code units,
 * then murmur3 fmix32. Uses BigInt arithmetic mod 2^32 instead of Math.imul.
 */
function refHash(text: string): number {
  const M = 0xffffffffn;
  const mul = (a: bigint, b: bigint): bigint => (a * b) & M;
  let h = 2166136261n;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = mul(h, 16777619n);
  }
  h ^= h >> 16n;
  h = mul(h, 0x85ebca6bn);
  h ^= h >> 13n;
  h = mul(h, 0xc2b2ae35n);
  h ^= h >> 16n;
  return Number(h);
}

describe('alphabet', () => {
  it('is the unambiguous 31-char alphabet with 7-char codes', () => {
    expect(CODE_ALPHABET).toBe(EXPECTED_ALPHABET);
    expect(CODE_ALPHABET).toHaveLength(31);
    expect(new Set(CODE_ALPHABET).size).toBe(31);
    for (const ch of '0O1IL') expect(CODE_ALPHABET).not.toContain(ch);
    expect(CODE_LENGTH).toBe(7);
  });
});

describe('newCode', () => {
  it.each([
    ['Math.random', () => Math.random],
    ['seeded mulberry32', () => mulberry32(20261123)],
  ])('10 000 codes with %s match the canonical format', (_, make) => {
    const random = make();
    const codes: string[] = [];
    for (let i = 0; i < 10_000; i++) codes.push(newCode(random));
    for (const code of codes) {
      expect(code).toMatch(CODE_RE);
      expect(parseCode(code)).toEqual({ ok: true, code });
    }
    const seen = new Set(CODE_ALPHABET);
    const used = new Set(codes.join('').replace(/-/g, ''));
    expect(used).toEqual(seen);
    const duplicates = codes.length - new Set(codes).size;
    expect(duplicates).toBeLessThan(100);
  });

  it('uses Math.random by default', () => {
    expect(newCode()).toMatch(CODE_RE);
  });

  it('is deterministic with an injected random', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const listA = Array.from({ length: 50 }, () => newCode(a));
    const listB = Array.from({ length: 50 }, () => newCode(b));
    expect(listA).toEqual(listB);
    expect(new Set(listA).size).toBe(50);
  });

  it('consumes exactly 7 random values and maps them by index', () => {
    const values = [0, 1 / 31, 2 / 31, 30 / 31, 0.5, 0.999999, 0];
    let calls = 0;
    const code = newCode(() => values[calls++]);
    expect(calls).toBe(7);
    // floor(0.5*31)=15 -> 'S'; 30/31 -> '9'
    expect(code).toBe('ABC9-S9A');
  });

  it('never goes out of the alphabet on edge values', () => {
    expect(newCode(() => 0)).toBe('AAAA-AAA');
    expect(newCode(() => 1 - Number.EPSILON)).toBe('9999-999');
    expect(newCode(() => 1)).toBe('9999-999');
  });

  it('has a roughly uniform character distribution (chi-square)', () => {
    const random = mulberry32(123456);
    const counts = new Map<string, number>();
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      for (const ch of newCode(random).replace('-', '')) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    const total = n * CODE_LENGTH;
    const expected = total / CODE_ALPHABET.length;
    let chi2 = 0;
    for (const ch of CODE_ALPHABET) {
      const c = counts.get(ch) ?? 0;
      chi2 += (c - expected) ** 2 / expected;
      expect(Math.abs(c - expected) / expected).toBeLessThan(0.05);
    }
    // 30 degrees of freedom: p = 0.001 critical value is ~59.7.
    expect(chi2).toBeLessThan(59.7);
  });

  it('is position-independent (each position uses the whole alphabet)', () => {
    const random = mulberry32(99);
    const perPos = Array.from({ length: CODE_LENGTH }, () => new Set<string>());
    for (let i = 0; i < 5000; i++) {
      [...newCode(random).replace('-', '')].forEach((ch, p) => perPos[p].add(ch));
    }
    for (const set of perPos) expect(set.size).toBe(31);
  });
});

describe('parseCode', () => {
  it.each([
    'k7f2 9qx',
    'K7F2-9QX',
    ' k7f29qx ',
    'K7F-29QX',
    'k7f2\t9qx',
    'K-7-F-2-9-Q-X',
    'k7F2--9qX',
  ])('accepts %j as K7F2-9QX', (input) => {
    expect(parseCode(input)).toEqual({ ok: true, code: 'K7F2-9QX' });
    expect(normalizeCode(input)).toBe('K7F2-9QX');
    expect(isValidCode(input)).toBe(true);
  });

  it.each(['', '   ', '---', 'K7F2-9Q', 'K7F29Q', 'K7F2-9QXA', 'K7F29QXAB', 'ABC'])(
    'rejects %j with a length error',
    (input) => {
      expect(parseCode(input)).toEqual({ ok: false, error: LENGTH_ERROR });
      expect(normalizeCode(input)).toBeNull();
      expect(isValidCode(input)).toBe(false);
    },
  );

  it.each([
    'K7F2-9Q0',
    'K7F2-9QO',
    'K7F2-9Qo',
    'K7F2-9Q1',
    'K7F2-9QI',
    'K7F2-9Qi',
    'K7F2-9QL',
    'K7F2-9Ql',
    'K7F2-9Q!',
    'K7F_9QX',
    'K7F2-9Q+',
    'K7F.9QX',
    'K7F2-9QÉ',
    'K7F2-9Qé',
    'K7F2-9QÀ',
    'K7F2-9QＫ',
    'K7F2-9\u{1F600}',
  ])('rejects %j with an invalid-characters error', (input) => {
    expect(parseCode(input)).toEqual({ ok: false, error: CHARS_ERROR });
    expect(normalizeCode(input)).toBeNull();
    expect(isValidCode(input)).toBe(false);
  });

  it('does not map ambiguous characters to look-alikes', () => {
    expect(normalizeCode('K7F2-9Q0')).not.toBe('K7F2-9QO');
    expect(normalizeCode('ABCD-EFO')).toBeNull();
    expect(normalizeCode('ABCD-EFI')).toBeNull();
  });

  it.each([
    ['K7F2-9ß', 'ß uppercases to SS'],
    ['K7F2-9Qſ', 'long s uppercases to S'],
    ['K7F2-9ﬀ', 'ff ligature uppercases to FF'],
  ])('rejects %j (%s) instead of mapping it', (input) => {
    expect(isValidCode(input)).toBe(false);
  });

  it('error messages are English and non-empty', () => {
    for (const input of ['', 'K7F2-9Q0']) {
      const r = parseCode(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/^[A-Za-z0-9 ]+$/);
    }
  });

  it('is idempotent and consistent with normalizeCode / isValidCode on random inputs', () => {
    const rng = mulberry32(31337);
    const pool = `${CODE_ALPHABET}${CODE_ALPHABET.toLowerCase()}0OIL1 -_!é`;
    for (let i = 0; i < 5000; i++) {
      const len = 5 + Math.floor(rng() * 6);
      let s = '';
      for (let j = 0; j < len; j++) s += pool[Math.floor(rng() * pool.length)];
      const r = parseCode(s);
      expect(normalizeCode(s)).toBe(r.ok ? r.code : null);
      expect(isValidCode(s)).toBe(r.ok);
      if (r.ok) {
        expect(r.code).toMatch(CODE_RE);
        expect(parseCode(r.code)).toEqual(r);
        expect(parseCode(r.code.toLowerCase())).toEqual(r);
      }
    }
  });
});

describe('codeToSeed / turnSeed', () => {
  const CODE = 'K7F2-9QX';

  it('pins known regression values', () => {
    expect(codeToSeed(CODE)).toBe(737403460);
    expect(turnSeed(CODE, 1)).toBe(1872620240);
    expect(turnSeed(CODE, 2)).toBe(92595522);
  });

  it('matches an independent FNV-1a + fmix32 implementation', () => {
    expect(refHash(CODE)).toBe(737403460);
    expect(refHash(`${CODE}#1`)).toBe(1872620240);
    expect(refHash(`${CODE}#2`)).toBe(92595522);
    const rng = mulberry32(555);
    for (let i = 0; i < 500; i++) {
      const code = newCode(rng);
      const turn = Math.floor(rng() * 1000);
      expect(codeToSeed(code)).toBe(refHash(code));
      expect(turnSeed(code, turn)).toBe(refHash(`${code}#${turn}`));
    }
  });

  it('returns uint32 integers and is deterministic', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const code = newCode(rng);
      const s = codeToSeed(code);
      expect(isUint32(s)).toBe(true);
      expect(codeToSeed(code)).toBe(s);
      for (const turn of [0, 1, 5, 99]) {
        const t = turnSeed(code, turn);
        expect(isUint32(t)).toBe(true);
        expect(turnSeed(code, turn)).toBe(t);
      }
    }
  });

  it('is insensitive to input formatting', () => {
    for (const variant of ['k7f2 9qx', ' k7f29qx ', 'K7F-29QX', 'k-7-f-2-9-q-x']) {
      expect(codeToSeed(variant)).toBe(codeToSeed(CODE));
      expect(turnSeed(variant, 3)).toBe(turnSeed(CODE, 3));
    }
  });

  it('gives distinct seeds for turns 1-100 of one code', () => {
    const seeds = new Set<number>();
    for (let turn = 1; turn <= 100; turn++) seeds.add(turnSeed(CODE, turn));
    expect(seeds.size).toBe(100);
    expect(seeds.has(codeToSeed(CODE))).toBe(false);
  });

  it('gives distinct turn seeds for 1000 random codes x turns 1-20', () => {
    const rng = mulberry32(2024);
    for (let i = 0; i < 1000; i++) {
      const code = newCode(rng);
      const seeds = new Set<number>();
      for (let turn = 1; turn <= 20; turn++) seeds.add(turnSeed(code, turn));
      expect(seeds.size).toBe(20);
    }
  });

  it('rarely collides across 10 000 random codes', () => {
    const rng = mulberry32(77);
    const codes = new Set<string>();
    while (codes.size < 10_000) codes.add(newCode(rng));
    const seeds = new Set<number>();
    const turn1 = new Set<number>();
    for (const code of codes) {
      seeds.add(codeToSeed(code));
      turn1.add(turnSeed(code, 1));
    }
    // Birthday bound for 10 000 values in 2^32: ~0.012 expected collisions.
    expect(10_000 - seeds.size).toBeLessThanOrEqual(2);
    expect(10_000 - turn1.size).toBeLessThanOrEqual(2);
  });

  it('spreads close codes (avalanche sanity)', () => {
    const a = codeToSeed('AAAA-AAA');
    const b = codeToSeed('AAAA-AAB');
    const diff = (a ^ b) >>> 0;
    const bits = diff.toString(2).replace(/0/g, '').length;
    expect(bits).toBeGreaterThanOrEqual(8);
  });

  it.each(['', 'nope', 'K7F2-9Q0', 'K7F2-9Q', 'K7F2-9QXX'])('throws on invalid code %j', (code) => {
    expect(() => codeToSeed(code)).toThrow();
    expect(() => turnSeed(code, 1)).toThrow();
  });

  it.each([-1, 1.5, NaN, Infinity, -Infinity])('throws on invalid turn %s', (turn) => {
    expect(() => turnSeed(CODE, turn)).toThrow();
  });
});

describe('rngFor', () => {
  const CODE = 'K7F2-9QX';
  const take = (rng: () => number, n: number): number[] => Array.from({ length: n }, rng);

  it('equals mulberry32(turnSeed(code, turn))', () => {
    expect(take(rngFor(CODE, 1), 20)).toEqual(take(mulberry32(turnSeed(CODE, 1)), 20));
  });

  it('gives the same sequence for the same code + turn, whatever the formatting', () => {
    const ref = take(rngFor(CODE, 4), 100);
    expect(take(rngFor(CODE, 4), 100)).toEqual(ref);
    expect(take(rngFor('k7f2 9qx', 4), 100)).toEqual(ref);
    for (const v of ref) expect(v >= 0 && v < 1).toBe(true);
  });

  it('gives a different sequence for another turn or code', () => {
    const ref = take(rngFor(CODE, 1), 10);
    expect(take(rngFor(CODE, 2), 10)).not.toEqual(ref);
    expect(take(rngFor('K7F2-9QY', 1), 10)).not.toEqual(ref);
  });

  it('throws on an invalid code or turn', () => {
    expect(() => rngFor('K7F2-9Q0', 1)).toThrow();
    expect(() => rngFor('', 1)).toThrow();
    expect(() => rngFor(CODE, -1)).toThrow();
    expect(() => rngFor(CODE, 2.5)).toThrow();
    expect(() => rngFor(CODE, NaN)).toThrow();
  });
});

describe('same code + same turn = same walls', () => {
  it('placeConnectedWalls is reproducible for 200 random codes x turns 1-5', () => {
    const rng = mulberry32(8080);
    let differingTurnPairs = 0;
    let pairs = 0;
    for (let i = 0; i < 200; i++) {
      const code = newCode(rng);
      const boards = [];
      for (let turn = 1; turn <= 5; turn++) {
        const first = placeConnectedWalls(rngFor(code, turn));
        const second = placeConnectedWalls(rngFor(code.toLowerCase().replace('-', ' '), turn));
        expect(second).toEqual(first);
        boards.push(JSON.stringify(first));
      }
      for (let t = 1; t < boards.length; t++) {
        pairs++;
        if (boards[t] !== boards[t - 1]) differingTurnPairs++;
      }
    }
    // Consecutive turns should practically always give different walls.
    expect(differingTurnPairs / pairs).toBeGreaterThan(0.99);
  });

  it('pins the walls of K7F2-9QX turn 1 as a cross-device regression fixture', () => {
    const walls = placeConnectedWalls(rngFor('K7F2-9QX', 1));
    expect(walls).toEqual(placeConnectedWalls(mulberry32(1872620240)));
    expect(JSON.stringify(walls)).toBe(PINNED_WALLS_K7F2_9QX_T1);
  });
});
