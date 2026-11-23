import { describe, expect, it } from 'vitest';
import { allCells, DIRS, isInside, neighbors, parseCell, step } from './cell';
import { mulberry32 } from './rng';
import { isBorderSide, parseSide, sideEndpoints, sideKey } from './side';
import { BOARD_SIZE, type Cell, type GridPoint, type Rng, type Wall } from './types';
import {
  isBlocked,
  isValidWallShape,
  placeWalls,
  wallShape,
  wallSideSet,
  wallsOverlap,
} from './walls';

const c = (name: string): Cell => parseCell(name);
const wall = (...sides: string[]): Wall => ({ sides });

describe('wallSideSet', () => {
  it('normalises every side to its canonical key', () => {
    const set = wallSideSet([wall('D3-W', 'C4-N'), wall('A3-O', 'I3-E')]);
    expect([...set].sort()).toEqual(['A3-W', 'C3-E', 'C3-S', 'I3-E']);
  });

  it('is empty for no walls and deduplicates equivalent sides', () => {
    expect(wallSideSet([]).size).toBe(0);
    expect(wallSideSet([wall('C3-E'), wall('D3-W')]).size).toBe(1);
  });
});

describe('isBlocked', () => {
  const walls = [wall('C3-E', 'C3-S')];

  it('is false between adjacent cells with no wall', () => {
    expect(isBlocked(c('C3'), c('C2'), walls)).toBe(false);
    expect(isBlocked(c('C3'), c('B3'), walls)).toBe(false);
    expect(isBlocked(c('E5'), c('E6'), [])).toBe(false);
  });

  it('is true across a wall side, in both directions', () => {
    expect(isBlocked(c('C3'), c('D3'), walls)).toBe(true);
    expect(isBlocked(c('D3'), c('C3'), walls)).toBe(true);
    expect(isBlocked(c('C3'), c('C4'), walls)).toBe(true);
    expect(isBlocked(c('C4'), c('C3'), walls)).toBe(true);
  });

  it('works when the wall is written in the non-canonical notation', () => {
    const alt = [wall('D3-W', 'C4-N')];
    expect(isBlocked(c('C3'), c('D3'), alt)).toBe(true);
    expect(isBlocked(c('D3'), c('C3'), alt)).toBe(true);
    expect(isBlocked(c('C3'), c('C4'), alt)).toBe(true);
    expect(isBlocked(c('C4'), c('C3'), alt)).toBe(true);
    expect(isBlocked(c('D3'), c('E3'), alt)).toBe(false);
  });

  it('accepts lower-case and O-alias wall sides', () => {
    expect(isBlocked(c('C3'), c('D3'), [wall('d3-o')])).toBe(true);
  });

  it('finds walls in any wall of the list', () => {
    const many = [wall('A1-E'), wall('E5-S', 'F5-S'), wall('H8-E')];
    expect(isBlocked(c('F5'), c('F6'), many)).toBe(true);
    expect(isBlocked(c('I8'), c('H8'), many)).toBe(true);
    expect(isBlocked(c('G5'), c('G6'), many)).toBe(false);
  });

  it('is true when b is off-board on each of the four borders', () => {
    expect(isBlocked(c('C1'), { x: 2, y: -1 }, [])).toBe(true);
    expect(isBlocked(c('A3'), { x: -1, y: 2 }, [])).toBe(true);
    expect(isBlocked(c('I3'), { x: 9, y: 2 }, [])).toBe(true);
    expect(isBlocked(c('C9'), { x: 2, y: 9 }, [])).toBe(true);
  });

  it('is true for every off-board move and false for every in-board move without walls', () => {
    for (const cell of allCells()) {
      for (const dir of DIRS) {
        const other = step(cell, dir);
        expect(isBlocked(cell, other, [])).toBe(!isInside(other));
      }
    }
  });

  it('blocks exactly the walled side for every interior side', () => {
    for (const cell of allCells()) {
      for (const n of neighbors(cell)) {
        const dir = DIRS.find((d) => {
          const t = step(cell, d);
          return t.x === n.x && t.y === n.y;
        });
        if (!dir) throw new Error('unreachable');
        const w = [wall(sideKey({ cell, dir }))];
        expect(isBlocked(cell, n, w)).toBe(true);
        expect(isBlocked(n, cell, w)).toBe(true);
        for (const other of neighbors(cell)) {
          if (other.x === n.x && other.y === n.y) continue;
          expect(isBlocked(cell, other, w)).toBe(false);
        }
      }
    }
  });

  it.each([
    ['C3', 'C3'],
    ['C3', 'D4'],
    ['C3', 'E3'],
    ['A1', 'A3'],
  ])('throws when %s and %s are not adjacent', (a, b) => {
    expect(() => isBlocked(c(a), c(b), [])).toThrow();
  });

  it('throws when a is off-board', () => {
    expect(() => isBlocked({ x: -1, y: 0 }, c('A1'), [])).toThrow();
  });
});

const SEEDS = 1000;
const CANONICAL_RE = /^[A-I][1-9]-[ES]$/;

type Pt = readonly [number, number];

function pt(p: GridPoint): Pt {
  return [p.px, p.py];
}

function eq(a: Pt, b: Pt): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * Independent geometric analysis of a wall: walks the stored sides on the corner lattice and
 * returns the shape and number of sides, or an error message describing the first violation.
 */
function analyse(wall: Wall): { shape: 'straight' | 'L'; length: number } | { error: string } {
  const { sides } = wall;
  if (sides.length < 2 || sides.length > 5) {
    return { error: `length ${sides.length}` };
  }
  if (new Set(sides).size !== sides.length) {
    return { error: 'repeated side' };
  }
  for (const key of sides) {
    if (!CANONICAL_RE.test(key) || sideKey(parseSide(key)) !== key) {
      return { error: `non-canonical key ${key}` };
    }
    if (isBorderSide(key)) {
      return { error: `border side ${key}` };
    }
  }
  const segs = sides.map((k) => sideEndpoints(k).map(pt) as [Pt, Pt]);
  for (const [a, b] of segs) {
    const len = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    const inRange = [a, b].every(
      ([x, y]) => x >= 0 && x <= BOARD_SIZE && y >= 0 && y <= BOARD_SIZE,
    );
    if (len !== 1 || !inRange) {
      return { error: 'bad segment' };
    }
  }
  // Find the start vertex: the endpoint of segment 0 not shared with segment 1.
  const [s0a, s0b] = segs[0];
  const [s1a, s1b] = segs[1];
  const shares = (p: Pt): boolean => eq(p, s1a) || eq(p, s1b);
  let path: Pt[];
  if (shares(s0b) && !shares(s0a)) {
    path = [s0a, s0b];
  } else if (shares(s0a) && !shares(s0b)) {
    path = [s0b, s0a];
  } else {
    return { error: 'first two sides not contiguous' };
  }
  for (let i = 1; i < segs.length; i++) {
    const cur = path[path.length - 1];
    const [a, b] = segs[i];
    if (eq(a, cur)) {
      path.push(b);
    } else if (eq(b, cur)) {
      path.push(a);
    } else {
      return { error: `side ${i} not contiguous / not ordered` };
    }
  }
  for (let i = 0; i < path.length; i++) {
    for (let j = i + 1; j < path.length; j++) {
      if (eq(path[i], path[j])) {
        return { error: 'self-intersecting path' };
      }
    }
  }
  const dirs = path.slice(1).map((p, i) => `${p[0] - path[i][0]},${p[1] - path[i][1]}`);
  let turns = 0;
  for (let i = 1; i < dirs.length; i++) {
    if (dirs[i] !== dirs[i - 1]) {
      turns++;
    }
  }
  if (turns > 1) {
    return { error: `${turns} turns` };
  }
  return { shape: turns === 0 ? 'straight' : 'L', length: sides.length };
}

describe('placeWalls over 1000 seeds (independent geometry)', () => {
  it('produces 8 valid, canonical, ordered, non-overlapping, non-border walls', () => {
    const failures: string[] = [];
    for (let seed = 0; seed < SEEDS; seed++) {
      const walls = placeWalls(mulberry32(seed));
      if (walls.length !== 8) {
        failures.push(`seed ${seed}: ${walls.length} walls`);
        continue;
      }
      const owner = new Map<string, number>();
      walls.forEach((wall, i) => {
        const res = analyse(wall);
        if ('error' in res) {
          failures.push(`seed ${seed} wall ${i} [${wall.sides.join(',')}]: ${res.error}`);
        }
        for (const key of wall.sides) {
          const prev = owner.get(key);
          if (prev !== undefined && prev !== i) {
            failures.push(`seed ${seed}: side ${key} shared by walls ${prev} and ${i}`);
          }
          owner.set(key, i);
        }
      });
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('agrees with the developer validators on generated walls', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const walls = placeWalls(mulberry32(seed));
      expect(wallsOverlap(walls)).toBe(false);
      for (const wall of walls) {
        const res = analyse(wall);
        expect(wallShape(wall)).toBe('error' in res ? 'invalid' : res.shape);
      }
    }
  });

  it('has a sane distribution of lengths and shapes', () => {
    const lengths = new Map<number, number>();
    const shapes = new Map<string, number>();
    const lOrientations = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const wall of placeWalls(mulberry32(seed))) {
        const res = analyse(wall);
        if ('error' in res) {
          continue;
        }
        lengths.set(res.length, (lengths.get(res.length) ?? 0) + 1);
        shapes.set(res.shape, (shapes.get(res.shape) ?? 0) + 1);
        if (res.shape === 'L') {
          // Orientation = set of the two arm directions, independent of traversal order.
          const segs = wall.sides.map((k) => sideEndpoints(k));
          const horiz = segs.map(([a, b]) => a.py === b.py);
          const first = segs[0];
          const last = segs[segs.length - 1];
          const corner = horiz.indexOf(!horiz[0]);
          const pivot = sideEndpoints(wall.sides[corner]);
          const prev = sideEndpoints(wall.sides[corner - 1]);
          const c = [pivot[0], pivot[1]].find((p) =>
            [prev[0], prev[1]].some((q) => q.px === p.px && q.py === p.py),
          );
          if (c) {
            const far = [first[0], first[1], last[0], last[1]].map(
              (p) => `${Math.sign(p.px - c.px)},${Math.sign(p.py - c.py)}`,
            );
            lOrientations.add(
              far
                .filter((d) => d !== '0,0')
                .sort()
                .join('|'),
            );
          }
        }
      }
    }
    for (const len of [2, 3, 4, 5]) {
      expect(lengths.get(len) ?? 0, `length ${len}`).toBeGreaterThan(0);
    }
    expect(shapes.get('straight') ?? 0).toBeGreaterThan(0);
    expect(shapes.get('L') ?? 0).toBeGreaterThan(0);
    expect(lOrientations.size).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic per seed and varies across seeds', () => {
    const layouts = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const a = placeWalls(mulberry32(seed));
      const b = placeWalls(mulberry32(seed));
      expect(b).toEqual(a);
      layouts.add(JSON.stringify(a));
    }
    expect(layouts.size).toBeGreaterThan(SEEDS * 0.99);
  });

  it('is fast: 1000 calls average well under 10 ms', () => {
    const start = performance.now();
    for (let seed = 0; seed < SEEDS; seed++) {
      placeWalls(mulberry32(seed + 10_000));
    }
    const avg = (performance.now() - start) / SEEDS;
    expect(avg).toBeLessThan(2);
  });

  it('terminates (returns or throws) with degenerate rngs', () => {
    const constants: Rng[] = [() => 0, () => 0.5, () => 0.999999];
    for (const rng of constants) {
      const start = performance.now();
      let result: Wall[] | null = null;
      try {
        result = placeWalls(rng);
      } catch {
        result = null;
      }
      expect(performance.now() - start).toBeLessThan(5000);
      if (result) {
        expect(result).toHaveLength(8);
        expect(result.every((w) => !('error' in analyse(w)))).toBe(true);
      }
    }
  });
});

describe('wall validators on hand-made cases', () => {
  // Corner lattice point (3, 3) is the bottom-right corner of C3.
  // Up: C3-E, C2-E. Down: C4-E, C5-E. Left: C3-S, B3-S. Right: D3-S, E3-S.
  it.each([
    ['straight horizontal', ['B2-S', 'C2-S', 'D2-S'], 'straight'],
    ['straight vertical', ['B2-E', 'B3-E'], 'straight'],
    ['straight of 5', ['B4-S', 'C4-S', 'D4-S', 'E4-S', 'F4-S'], 'straight'],
    ['straight ending on the border line', ['A1-S', 'B1-S'], 'straight'],
    ['L up-right', ['C2-E', 'C3-E', 'D3-S', 'E3-S'], 'L'],
    ['L up-left', ['C2-E', 'C3-E', 'C3-S', 'B3-S'], 'L'],
    ['L down-right', ['C5-E', 'C4-E', 'D3-S'], 'L'],
    ['L down-left', ['C4-E', 'C3-S', 'B3-S'], 'L'],
    ['L minimal (2 sides)', ['C3-E', 'D3-S'], 'L'],
    ['L of 5 sides', ['C1-E', 'C2-E', 'C3-E', 'D3-S', 'E3-S'], 'L'],
    ['U shape', ['A4-E', 'B3-S', 'C3-S', 'C4-E'], 'invalid'],
    ['zig-zag (two turns)', ['C2-E', 'C3-E', 'D3-S', 'D4-E'], 'invalid'],
    ['T / branching', ['C3-S', 'D3-S', 'C3-E'], 'invalid'],
    ['plus-branch', ['C2-E', 'C3-E', 'C3-S', 'D3-S'], 'invalid'],
    ['non-contiguous', ['B2-E', 'B4-E'], 'invalid'],
    ['contiguous set but unordered', ['C2-E', 'D3-S', 'C3-E'], 'invalid'],
    ['1 side', ['B2-E'], 'invalid'],
    ['0 sides', [], 'invalid'],
    ['6 sides', ['B2-S', 'C2-S', 'D2-S', 'E2-S', 'F2-S', 'G2-S'], 'invalid'],
    ['border side west', ['A2-W', 'A3-W'], 'invalid'],
    ['border side east', ['I2-E', 'I3-E'], 'invalid'],
    ['border side south', ['A9-S', 'B9-S'], 'invalid'],
    ['border side north', ['B1-N', 'C1-N'], 'invalid'],
    ['repeated side', ['B2-E', 'B2-E'], 'invalid'],
    ['repeated side (alias)', ['B2-E', 'C2-W'], 'invalid'],
    ['garbage key', ['Z9-E', 'B2-E'], 'invalid'],
  ] as const)('%s → %s', (_name, sides, expected) => {
    const wall = { sides: [...sides] };
    expect(wallShape(wall)).toBe(expected);
    expect(isValidWallShape(wall)).toBe(expected !== 'invalid');
    // Cross-check with the independent analysis when all keys are canonical.
    if (sides.every((s) => CANONICAL_RE.test(s))) {
      const res = analyse(wall);
      expect('error' in res ? 'invalid' : res.shape).toBe(expected);
    }
  });

  it('detects overlap between two walls', () => {
    expect(wallsOverlap([{ sides: ['C2-E', 'C3-E'] }, { sides: ['C3-E', 'D3-S'] }])).toBe(true);
    // Same physical side written differently.
    expect(wallsOverlap([{ sides: ['B2-E', 'B3-E'] }, { sides: ['C3-W', 'C4-W'] }])).toBe(true);
    expect(wallsOverlap([{ sides: ['B2-S', 'C2-S'] }, { sides: ['C3-N', 'D3-N'] }])).toBe(true);
  });

  it('does not report touching walls as overlapping', () => {
    // Share the lattice point (3, 3) only.
    expect(wallsOverlap([{ sides: ['C2-E', 'C3-E'] }, { sides: ['C3-S', 'B3-S'] }])).toBe(false);
    expect(wallsOverlap([{ sides: ['C2-E', 'C3-E'] }, { sides: ['C4-E', 'C5-E'] }])).toBe(false);
    expect(wallsOverlap([{ sides: ['C2-E', 'C3-E'] }])).toBe(false);
    expect(wallsOverlap([])).toBe(false);
  });
});
