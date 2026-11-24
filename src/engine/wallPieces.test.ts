/**
 * Task #23 — the eight fixed wall pieces (decision D12) and `matchesPiece`.
 *
 * Side keys are built here from lattice paths with an independent helper (no engine geometry),
 * so `matchesPiece` is checked against hand-made walls.
 */
import { describe, expect, it } from 'vitest';
import {
  CELL_SIZE_MM,
  matchesPiece,
  mulberry32,
  placeWalls,
  WALL_COUNT,
  WALL_PIECES,
  wallPiece,
  type Wall,
  type WallId,
} from './index';

const COLS = 'ABCDEFGHI';
const IDS: WallId[] = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

/** Unit steps on the corner lattice, y growing downwards (row 1 at the top). */
const STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] } as const;
type D = keyof typeof STEP;

/**
 * Side keys of the lattice path starting at corner (px, py) and following `dirs`.
 * Horizontal segment (x, y)–(x + 1, y) = south side of cell column x, row y (1-based y).
 * Vertical segment (x, y)–(x, y + 1) = east side of cell column x - 1, row y + 1.
 */
function path(px: number, py: number, dirs: string): string[] {
  const keys: string[] = [];
  let x = px;
  let y = py;
  for (const d of dirs as unknown as D[]) {
    const [dx, dy] = STEP[d];
    const nx = x + dx;
    const ny = y + dy;
    if (dy === 0) keys.push(`${COLS[Math.min(x, nx)]}${y}-S`);
    else keys.push(`${COLS[x - 1]}${Math.min(y, ny) + 1}-E`);
    x = nx;
    y = ny;
  }
  return keys;
}

const w = (id: WallId, sides: string[]): Wall => ({ id, sides });

/** The four clockwise rotations of an L `[a, b]`, as step strings. */
function rotations(a: number, b: number): string[] {
  const order: D[] = ['E', 'S', 'W', 'N'];
  return order.map((d, i) => d.repeat(a) + order[(i + 1) % 4].repeat(b));
}

/** The four mirrored (counter-clockwise) versions of an L `[a, b]`. */
function mirrors(a: number, b: number): string[] {
  const order: D[] = ['E', 'N', 'W', 'S'];
  return order.map((d, i) => d.repeat(a) + order[(i + 1) % 4].repeat(b));
}

describe('WALL_PIECES', () => {
  it('has 44 mm cells', () => {
    expect(CELL_SIZE_MM).toBe(44);
  });

  it('lists the eight pieces of D12 in id order', () => {
    expect(WALL_PIECES).toHaveLength(8);
    expect(WALL_COUNT).toBe(8);
    expect(
      WALL_PIECES.map((p) => ({
        id: p.id,
        shape: p.shape,
        arms: [...p.arms],
        length: p.length,
        sizeMm: p.sizeMm,
      })),
    ).toEqual([
      { id: 'W1', shape: 'straight', arms: [2], length: 2, sizeMm: '88 mm' },
      { id: 'W2', shape: 'straight', arms: [2], length: 2, sizeMm: '88 mm' },
      { id: 'W3', shape: 'straight', arms: [3], length: 3, sizeMm: '132 mm' },
      { id: 'W4', shape: 'straight', arms: [4], length: 4, sizeMm: '176 mm' },
      { id: 'W5', shape: 'L', arms: [1, 1], length: 2, sizeMm: '44 + 44 mm' },
      { id: 'W6', shape: 'L', arms: [2, 1], length: 3, sizeMm: '88 + 44 mm' },
      { id: 'W7', shape: 'L', arms: [2, 2], length: 4, sizeMm: '88 + 88 mm' },
      { id: 'W8', shape: 'L', arms: [3, 2], length: 5, sizeMm: '132 + 88 mm' },
    ]);
  });

  it('is frozen, pieces included', () => {
    expect(Object.isFrozen(WALL_PIECES)).toBe(true);
    for (const p of WALL_PIECES) {
      expect(Object.isFrozen(p)).toBe(true);
      expect(Object.isFrozen(p.arms)).toBe(true);
    }
  });

  it('wallPiece finds each id and returns undefined for an unknown one', () => {
    for (const id of IDS) expect(wallPiece(id)?.id).toBe(id);
    expect(wallPiece('W9' as WallId)).toBeUndefined();
  });
});

describe('path helper (self-check)', () => {
  it('builds the expected keys', () => {
    expect(path(2, 2, 'EES')).toEqual(['C2-S', 'D2-S', 'D3-E']);
    expect(path(3, 2, 'SSWW')).toEqual(['C3-E', 'C4-E', 'C4-S', 'B4-S']);
  });
});

describe('matchesPiece — straight pieces', () => {
  it.each([
    ['W1', 2],
    ['W2', 2],
    ['W3', 3],
    ['W4', 4],
  ] as const)('%s: horizontal and vertical, both reading directions', (id, n) => {
    for (const dirs of ['E'.repeat(n), 'S'.repeat(n), 'W'.repeat(n), 'N'.repeat(n)]) {
      const sides = path(5, 5, dirs);
      expect(matchesPiece(w(id, sides)), `${id} ${dirs}`).toBe(true);
      expect(matchesPiece(w(id, [...sides].reverse())), `${id} ${dirs} reversed`).toBe(true);
    }
  });

  it('rejects a wrong length', () => {
    expect(matchesPiece(w('W1', path(4, 4, 'EEE')))).toBe(false);
    expect(matchesPiece(w('W3', path(4, 4, 'EE')))).toBe(false);
    expect(matchesPiece(w('W4', path(4, 4, 'SSS')))).toBe(false);
    expect(matchesPiece(w('W4', path(4, 4, 'SSSSS')))).toBe(false);
  });

  it('rejects an L shape under a straight id', () => {
    expect(matchesPiece(w('W1', path(4, 4, 'ES')))).toBe(false);
    expect(matchesPiece(w('W3', path(4, 4, 'EES')))).toBe(false);
  });

  it('rejects border sides and broken walls', () => {
    expect(matchesPiece(w('W1', ['A2-W', 'A3-W']))).toBe(false);
    expect(matchesPiece(w('W1', ['B2-E', 'B4-E']))).toBe(false);
  });
});

describe('matchesPiece — L pieces', () => {
  const L: [WallId, number, number][] = [
    ['W5', 1, 1],
    ['W6', 2, 1],
    ['W7', 2, 2],
    ['W8', 3, 2],
  ];

  it.each(L)('%s: each of the 4 rotations matches', (id, a, b) => {
    for (const dirs of rotations(a, b)) {
      expect(matchesPiece(w(id, path(5, 5, dirs))), `${id} ${dirs}`).toBe(true);
    }
  });

  it.each(L)('%s: each rotation read from the other end matches', (id, a, b) => {
    for (const dirs of rotations(a, b)) {
      const sides = path(5, 5, dirs).reverse();
      expect(matchesPiece(w(id, sides)), `${id} ${dirs} reversed`).toBe(true);
    }
  });

  it.each([
    ['W6', 2, 1],
    ['W8', 3, 2],
  ] as const)('%s: mirrored piece rejected in every rotation and reading', (id, a, b) => {
    for (const dirs of mirrors(a, b)) {
      const sides = path(5, 5, dirs);
      expect(matchesPiece(w(id, sides)), `${id} mirror ${dirs}`).toBe(false);
      expect(matchesPiece(w(id, [...sides].reverse())), `${id} mirror ${dirs} rev`).toBe(false);
    }
  });

  it('W6 hand cases: ‾‾| matches, |‾‾ (mirror) does not', () => {
    // 2 East then 1 South: clockwise → the real piece.
    expect(matchesPiece(w('W6', ['C2-S', 'D2-S', 'D3-E']))).toBe(true);
    // Same read from the short arm: 1 North, then 2 West (counter-clockwise) → same piece.
    expect(matchesPiece(w('W6', ['D3-E', 'D2-S', 'C2-S']))).toBe(true);
    // 2 West then 1 South: counter-clockwise → mirror.
    expect(matchesPiece(w('W6', ['D2-S', 'C2-S', 'B3-E']))).toBe(false);
  });

  it.each([
    ['W5', 1, 1],
    ['W7', 2, 2],
  ] as const)('%s: equal arms, the mirror image is a rotation and matches', (id, a, b) => {
    for (const dirs of mirrors(a, b)) {
      expect(matchesPiece(w(id, path(5, 5, dirs))), `${id} ${dirs}`).toBe(true);
    }
  });

  it('rejects wrong arm lengths and wrong total length', () => {
    // W6 needs arms 2 + 1.
    // 1 East then 2 South: read from the long arm it is 2 North then West (counter-clockwise).
    expect(matchesPiece(w('W6', path(5, 5, 'ESS')))).toBe(false);
    expect(matchesPiece(w('W6', path(5, 5, 'EESS')))).toBe(false);
    expect(matchesPiece(w('W6', path(5, 5, 'ES')))).toBe(false);
    // W8 needs 3 + 2: 4 + 1 and 2 + 3 (clockwise) are wrong.
    expect(matchesPiece(w('W8', path(4, 4, 'EEEES')))).toBe(false);
    expect(matchesPiece(w('W8', path(4, 4, 'EESSS')))).toBe(false);
    // W7 needs 2 + 2: 3 + 1 is wrong.
    expect(matchesPiece(w('W7', path(4, 4, 'EEES')))).toBe(false);
    // W5 needs 1 + 1.
    expect(matchesPiece(w('W5', path(4, 4, 'EES')))).toBe(false);
  });

  it('rejects a straight shape under an L id and an unknown id', () => {
    expect(matchesPiece(w('W5', path(4, 4, 'EE')))).toBe(false);
    expect(matchesPiece(w('W8', path(2, 4, 'EEEEE')))).toBe(false);
    expect(matchesPiece(w('W9' as WallId, path(4, 4, 'EE')))).toBe(false);
  });
});

describe('placeWalls output', () => {
  it('matches its pieces, ids W1 … W8 in order, over 500 seeds', () => {
    for (let seed = 0; seed < 500; seed++) {
      const walls = placeWalls(mulberry32(seed));
      expect(
        walls.map((x) => x.id),
        `seed ${seed}`,
      ).toEqual(IDS);
      for (const wall of walls) {
        expect(matchesPiece(wall), `seed ${seed} ${wall.id} ${wall.sides.join(' ')}`).toBe(true);
      }
    }
  });
});
