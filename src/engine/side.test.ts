import { describe, expect, it } from 'vitest';
import { allCells, cellName, DIRS, isInside, OPPOSITE, parseCell, step } from './cell';
import {
  cellsOfSide,
  isBorderSide,
  normalizeSide,
  parseSide,
  sameSide,
  sideBetween,
  sideEndpoints,
  sideKey,
} from './side';
import type { Cell, Dir, Side } from './types';

const c = (name: string): Cell => parseCell(name);
const s = (str: string): Side => parseSide(str);
const keyOf = (str: string): string => sideKey(parseSide(str));

describe('parseSide', () => {
  it('parses a side as written (not normalised)', () => {
    expect(parseSide('D3-W')).toEqual({ cell: { x: 3, y: 2 }, dir: 'W' });
    expect(parseSide('C4-N')).toEqual({ cell: { x: 2, y: 3 }, dir: 'N' });
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseSide('c3-e')).toEqual({ cell: { x: 2, y: 2 }, dir: 'E' });
    expect(parseSide('  i9-s ')).toEqual({ cell: { x: 8, y: 8 }, dir: 'S' });
  });

  it('accepts O as an alias of W (any case)', () => {
    expect(parseSide('D3-O')).toEqual(parseSide('D3-W'));
    expect(parseSide('d3-o')).toEqual({ cell: { x: 3, y: 2 }, dir: 'W' });
    expect(keyOf('D3-O')).toBe('C3-E');
    expect(keyOf('A3-O')).toBe('A3-W');
  });

  it.each([
    '',
    'C3',
    'C3-',
    '-E',
    'C3-X',
    'C3E',
    'C3 E',
    'C3--E',
    'J3-E',
    'C0-E',
    'C10-E',
    'C3-EE',
    'C3-NE',
    'garbage',
  ])('throws on %j', (str) => {
    expect(() => parseSide(str)).toThrow();
  });
});

describe('normalizeSide / sideKey', () => {
  it('canonicalises W and N sides to the neighbour E/S side', () => {
    expect(keyOf('D3-W')).toBe('C3-E');
    expect(keyOf('C4-N')).toBe('C3-S');
    expect(keyOf('C3-E')).toBe('C3-E');
    expect(keyOf('C3-S')).toBe('C3-S');
    expect(normalizeSide(s('D3-W'))).toEqual({ cell: { x: 2, y: 2 }, dir: 'E' });
  });

  it('keeps border sides as-is on all four borders', () => {
    expect(keyOf('A3-W')).toBe('A3-W');
    expect(keyOf('C1-N')).toBe('C1-N');
    expect(keyOf('I3-E')).toBe('I3-E');
    expect(keyOf('C9-S')).toBe('C9-S');
    expect(keyOf('A1-N')).toBe('A1-N');
    expect(keyOf('A1-W')).toBe('A1-W');
    expect(keyOf('I9-E')).toBe('I9-E');
    expect(keyOf('I9-S')).toBe('I9-S');
  });

  it('gives the same key for every interior side from both cells', () => {
    let interior = 0;
    const keys = new Set<string>();
    for (const cell of allCells()) {
      for (const dir of DIRS) {
        const other = step(cell, dir);
        if (!isInside(other)) continue;
        interior++;
        const a = sideKey({ cell, dir });
        const b = sideKey({ cell: other, dir: OPPOSITE[dir] });
        expect(a).toBe(b);
        expect(a).toMatch(/^[A-I][1-9]-[ES]$/);
        expect(sameSide({ cell, dir }, { cell: other, dir: OPPOSITE[dir] })).toBe(true);
        keys.add(a);
      }
    }
    // 2 * 9 * 8 = 144 interior sides, each visited twice.
    expect(interior).toBe(288);
    expect(keys.size).toBe(144);
  });

  it('produces 180 distinct sides overall (144 interior + 36 border)', () => {
    const keys = new Set<string>();
    for (const cell of allCells()) {
      for (const dir of DIRS) keys.add(sideKey({ cell, dir }));
    }
    expect(keys.size).toBe(180);
    expect([...keys].filter((k) => isBorderSide(k))).toHaveLength(36);
  });

  it('is idempotent and does not mutate input', () => {
    const side = s('D3-W');
    const once = normalizeSide(side);
    expect(normalizeSide(once)).toEqual(once);
    expect(side).toEqual({ cell: { x: 3, y: 2 }, dir: 'W' });
  });

  it('throws for an off-board cell', () => {
    expect(() => normalizeSide({ cell: { x: 9, y: 0 }, dir: 'W' })).toThrow();
    expect(() => sideKey({ cell: { x: 0, y: -1 }, dir: 'S' })).toThrow();
  });
});

describe('sameSide', () => {
  it('compares sides across notations', () => {
    expect(sameSide('C3-E', 'D3-W')).toBe(true);
    expect(sameSide('C3-E', 'd3-o')).toBe(true);
    expect(sameSide('C3-S', 'C4-N')).toBe(true);
    expect(sameSide('C3-E', 'C3-S')).toBe(false);
    expect(sameSide('A3-W', 'A3-E')).toBe(false);
  });
});

describe('sideBetween', () => {
  it('returns the canonical key for adjacent cells in either order', () => {
    expect(sideBetween(c('C3'), c('D3'))).toBe('C3-E');
    expect(sideBetween(c('D3'), c('C3'))).toBe('C3-E');
    expect(sideBetween(c('C3'), c('C4'))).toBe('C3-S');
    expect(sideBetween(c('C4'), c('C3'))).toBe('C3-S');
  });

  it('matches sideKey for every in-board adjacent pair', () => {
    for (const cell of allCells()) {
      for (const dir of DIRS) {
        const other = step(cell, dir);
        if (!isInside(other)) continue;
        expect(sideBetween(cell, other)).toBe(sideKey({ cell, dir }));
      }
    }
  });

  it('returns the border side when one cell is off-board (all four borders)', () => {
    expect(sideBetween(c('A3'), { x: -1, y: 2 })).toBe('A3-W');
    expect(sideBetween({ x: -1, y: 2 }, c('A3'))).toBe('A3-W');
    expect(sideBetween(c('C1'), { x: 2, y: -1 })).toBe('C1-N');
    expect(sideBetween(c('I3'), { x: 9, y: 2 })).toBe('I3-E');
    expect(sideBetween(c('C9'), { x: 2, y: 9 })).toBe('C9-S');
  });

  it.each([
    ['C3', 'C3'],
    ['C3', 'D4'],
    ['C3', 'E3'],
    ['A1', 'I9'],
  ])('throws for non-adjacent %s / %s', (a, b) => {
    expect(() => sideBetween(c(a), c(b))).toThrow();
  });

  it('throws when both cells are off-board', () => {
    expect(() => sideBetween({ x: -1, y: -1 }, { x: -1, y: -2 })).toThrow();
  });
});

describe('isBorderSide', () => {
  it('is true for border sides on all four edges', () => {
    for (const k of ['A3-W', 'C1-N', 'I3-E', 'C9-S', 'A1-N', 'A1-W', 'I9-E', 'I9-S']) {
      expect(isBorderSide(k)).toBe(true);
      expect(isBorderSide(s(k))).toBe(true);
    }
    expect(isBorderSide('A3-O')).toBe(true);
  });

  it('is false for interior sides in any notation', () => {
    for (const k of ['C3-E', 'D3-W', 'C3-S', 'C4-N', 'B3-W', 'C2-N', 'H3-E', 'C8-S']) {
      expect(isBorderSide(k)).toBe(false);
    }
  });

  it('agrees with step() leaving the board for every cell side', () => {
    for (const cell of allCells()) {
      for (const dir of DIRS) {
        expect(isBorderSide({ cell, dir })).toBe(!isInside(step(cell, dir)));
      }
    }
  });
});

describe('cellsOfSide', () => {
  it('returns both cells of an interior side, canonical cell first', () => {
    expect(cellsOfSide('C3-E').map(cellName)).toEqual(['C3', 'D3']);
    expect(cellsOfSide('D3-W').map(cellName)).toEqual(['C3', 'D3']);
    expect(cellsOfSide('C4-N').map(cellName)).toEqual(['C3', 'C4']);
    expect(cellsOfSide(s('C3-S')).map(cellName)).toEqual(['C3', 'C4']);
  });

  it('returns a single cell for border sides', () => {
    expect(cellsOfSide('A3-W').map(cellName)).toEqual(['A3']);
    expect(cellsOfSide('C1-N').map(cellName)).toEqual(['C1']);
    expect(cellsOfSide('I3-E').map(cellName)).toEqual(['I3']);
    expect(cellsOfSide('C9-S').map(cellName)).toEqual(['C9']);
  });

  it('length is 1 iff the side is a border side', () => {
    for (const cell of allCells()) {
      for (const dir of DIRS) {
        expect(cellsOfSide({ cell, dir }).length === 1).toBe(isBorderSide({ cell, dir }));
      }
    }
  });
});

describe('sideEndpoints', () => {
  it('returns lattice corners for each direction (top-left first)', () => {
    // C3 = (2, 2) spans corners (2,2)-(3,3).
    expect(sideEndpoints('C3-E')).toEqual([
      { px: 3, py: 2 },
      { px: 3, py: 3 },
    ]);
    expect(sideEndpoints('C3-S')).toEqual([
      { px: 2, py: 3 },
      { px: 3, py: 3 },
    ]);
    expect(sideEndpoints('C1-N')).toEqual([
      { px: 2, py: 0 },
      { px: 3, py: 0 },
    ]);
    expect(sideEndpoints('A3-W')).toEqual([
      { px: 0, py: 2 },
      { px: 0, py: 3 },
    ]);
    expect(sideEndpoints('I9-E')).toEqual([
      { px: 9, py: 8 },
      { px: 9, py: 9 },
    ]);
    expect(sideEndpoints('I9-S')).toEqual([
      { px: 8, py: 9 },
      { px: 9, py: 9 },
    ]);
  });

  it('is identical for both notations of an interior side', () => {
    expect(sideEndpoints('D3-W')).toEqual(sideEndpoints('C3-E'));
    expect(sideEndpoints('C4-N')).toEqual(sideEndpoints('C3-S'));
  });

  it('yields unit segments on the 0–9 lattice for every side', () => {
    const dirs: Dir[] = ['N', 'E', 'S', 'W'];
    for (const cell of allCells()) {
      for (const dir of dirs) {
        const [p, q] = sideEndpoints({ cell, dir });
        for (const pt of [p, q]) {
          expect(pt.px).toBeGreaterThanOrEqual(0);
          expect(pt.px).toBeLessThanOrEqual(9);
          expect(pt.py).toBeGreaterThanOrEqual(0);
          expect(pt.py).toBeLessThanOrEqual(9);
        }
        expect(Math.abs(q.px - p.px) + Math.abs(q.py - p.py)).toBe(1);
        expect(q.px >= p.px && q.py >= p.py).toBe(true);
      }
    }
  });
});
