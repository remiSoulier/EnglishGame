import { describe, expect, it } from 'vitest';
import { allCells, cellName, parseCell } from './cell';
import {
  isFullyConnected,
  MAX_CONNECTED_ATTEMPTS,
  placeConnectedWalls,
  reachableCells,
} from './connectivity';
import { mulberry32 } from './rng';
import { BOARD_SIZE, WALL_COUNT, type Cell, type Rng, type Wall } from './types';
import { isValidWallShape, placeWalls, wallsOverlap } from './walls';

const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** Shorthand: one wall from side strings. */
const w = (...sides: string[]): Wall => ({ sides });

/** Names of the cells reachable from `from` (by name), sorted. */
const reachNames = (from: string, walls: readonly Wall[]): string[] =>
  reachableCells(parseCell(from), walls).map(cellName).sort();

/**
 * Independent canonical side set: every side mapped to "x,y,E" or "x,y,S" of the cell on its
 * west / north. Does not use any engine side helper.
 */
function mySideSet(walls: readonly Wall[]): Set<string> {
  const set = new Set<string>();
  for (const wall of walls) {
    for (const raw of wall.sides) {
      const m = /^([A-I])([1-9])-([NESWO])$/.exec(raw.trim().toUpperCase());
      if (!m) throw new Error(`bad side ${raw}`);
      let x = m[1].charCodeAt(0) - 65;
      let y = Number(m[2]) - 1;
      let d = m[3] === 'O' ? 'W' : m[3];
      if (d === 'N') {
        y -= 1;
        d = 'S';
      } else if (d === 'W') {
        x -= 1;
        d = 'E';
      }
      set.add(`${x},${y},${d}`);
    }
  }
  return set;
}

/** Union-find over the 81 cells; returns the root of each cell index. */
function unionFindRoots(walls: readonly Wall[]): number[] {
  const blocked = mySideSet(walls);
  const parent = Array.from({ length: CELL_COUNT }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number): void => {
    parent[find(a)] = find(b);
  };
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const i = y * BOARD_SIZE + x;
      if (x < BOARD_SIZE - 1 && !blocked.has(`${x},${y},E`)) union(i, i + 1);
      if (y < BOARD_SIZE - 1 && !blocked.has(`${x},${y},S`)) union(i, i + BOARD_SIZE);
    }
  }
  return Array.from({ length: CELL_COUNT }, (_, i) => find(i));
}

function ufConnected(walls: readonly Wall[]): boolean {
  const roots = unionFindRoots(walls);
  return roots.every((r) => r === roots[0]);
}

const idx = (c: Cell): number => c.y * BOARD_SIZE + c.x;

describe('isFullyConnected — hand-made cases', () => {
  it('empty board is connected', () => {
    expect(isFullyConnected([])).toBe(true);
  });

  it('corner A1 enclosed by an L is not connected', () => {
    const walls = [w('A1-E', 'A1-S')];
    expect(isValidWallShape(walls[0])).toBe(true);
    expect(isFullyConnected(walls)).toBe(false);
    expect(reachNames('A1', walls)).toEqual(['A1']);
  });

  it('interior cell E5 enclosed by two L walls is not connected', () => {
    const walls = [w('E4-S', 'E5-E'), w('E5-S', 'D5-E')];
    expect(walls.every(isValidWallShape)).toBe(true);
    expect(wallsOverlap(walls)).toBe(false);
    expect(isFullyConnected(walls)).toBe(false);
    expect(reachNames('E5', walls)).toEqual(['E5']);
    expect(reachableCells(parseCell('A1'), walls)).toHaveLength(80);
  });

  it('accepts either notation of a side (N/W/O, lowercase)', () => {
    const variants: Wall[][] = [
      [w('E5-N', 'E5-E'), w('E5-S', 'E5-W')],
      [w('e5-n', 'e5-e'), w('e5-s', 'e5-o')],
      [w('E4-S', 'F5-W'), w('E6-N', 'D5-E')],
    ];
    for (const walls of variants) {
      expect(walls.every(isValidWallShape)).toBe(true);
      expect(isFullyConnected(walls)).toBe(false);
      expect(reachNames('E5', walls)).toEqual(['E5']);
    }
    expect(isFullyConnected([w('B1-W', 'A2-N')])).toBe(false);
    expect(reachNames('A1', [w('B1-W', 'A2-N')])).toEqual(['A1']);
  });

  it('a border-to-border vertical line (2 straight walls 5 + 4) splits the board', () => {
    const walls = [w('E1-E', 'E2-E', 'E3-E', 'E4-E', 'E5-E'), w('E6-E', 'E7-E', 'E8-E', 'E9-E')];
    expect(walls.every(isValidWallShape)).toBe(true);
    expect(wallsOverlap(walls)).toBe(false);
    expect(isFullyConnected(walls)).toBe(false);
    expect(reachableCells(parseCell('A1'), walls)).toHaveLength(45);
    expect(reachableCells(parseCell('I9'), walls)).toHaveLength(36);
  });

  it('a border-to-border horizontal line written in N notation splits the board', () => {
    const walls = [w('A5-N', 'B5-N', 'C5-N', 'D5-N', 'E5-N'), w('F5-N', 'G5-N', 'H5-N', 'I5-N')];
    expect(walls.every(isValidWallShape)).toBe(true);
    expect(isFullyConnected(walls)).toBe(false);
    expect(reachableCells(parseCell('A1'), walls)).toHaveLength(36);
  });

  it('the same line with a one-side gap is connected', () => {
    const walls = [w('E1-E', 'E2-E', 'E3-E', 'E4-E', 'E5-E'), w('E6-E', 'E7-E', 'E8-E')];
    expect(isFullyConnected(walls)).toBe(true);
  });

  it('a nearly-closed 2×2 region with one gap is connected, closed is not', () => {
    // Region D4,E4,D5,E5 bounded by lattice x 3..5, y 3..5.
    const open = [
      w('D3-S', 'E3-S', 'E4-E'), // top + right upper
      w('E5-E', 'E5-S', 'D5-S'), // right lower + bottom
      w('C5-E', 'C6-N'), // left lower + outward stub: gap at C4-E
    ];
    expect(open.every(isValidWallShape)).toBe(true);
    expect(wallsOverlap(open)).toBe(false);
    expect(isFullyConnected(open)).toBe(true);
    const closed = [...open.slice(0, 2), w('C5-E', 'C4-E')];
    expect(closed.every(isValidWallShape)).toBe(true);
    expect(wallsOverlap(closed)).toBe(false);
    expect(isFullyConnected(closed)).toBe(false);
    expect(reachNames('D4', closed)).toEqual(['D4', 'D5', 'E4', 'E5']);
  });
});

describe('reachableCells', () => {
  it('contains `from`, has no duplicates and throws outside the board', () => {
    const walls = placeWalls(mulberry32(2));
    for (const c of allCells()) {
      const r = reachableCells(c, walls);
      expect(r).toContainEqual(c);
      expect(new Set(r.map(cellName)).size).toBe(r.length);
    }
    expect(() => reachableCells({ x: 9, y: 0 }, [])).toThrow();
    expect(() => reachableCells({ x: -1, y: 3 }, [])).toThrow();
  });

  // Heavy: kept to 30 seeds and one matrix comparison per board (not 2 × 81² expect calls), with
  // an explicit timeout so it stays robust when the suite runs in parallel on a loaded machine.
  it(
    'matches union-find components and is symmetric on random wall sets',
    { timeout: 30_000 },
    () => {
      let disconnectedBoards = 0;
      for (let seed = 0; seed < 30; seed++) {
        const walls = placeWalls(mulberry32(seed));
        const roots = unionFindRoots(walls);
        const reach = allCells().map((c) => new Set(reachableCells(c, walls).map(idx)));
        if (reach[0].size < CELL_COUNT) disconnectedBoards++;
        const asymmetric: string[] = [];
        const actual: boolean[][] = [];
        const expected: boolean[][] = [];
        for (let a = 0; a < CELL_COUNT; a++) {
          actual.push([]);
          expected.push([]);
          for (let b = 0; b < CELL_COUNT; b++) {
            if (reach[a].has(b) !== reach[b].has(a)) asymmetric.push(`${a}->${b}`);
            actual[a].push(reach[a].has(b));
            expected[a].push(roots[a] === roots[b]);
          }
        }
        expect(asymmetric, `seed ${seed}`).toEqual([]);
        expect(actual, `seed ${seed}`).toEqual(expected);
      }
      expect(disconnectedBoards).toBeGreaterThan(0);
    },
  );
});

describe('BFS vs independent union-find', { timeout: 30_000 }, () => {
  it('same verdict on 2 000 random placeWalls outputs', () => {
    let disconnected = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const walls = placeWalls(mulberry32(seed));
      const expected = ufConnected(walls);
      if (!expected) disconnected++;
      expect(isFullyConnected(walls), `seed ${seed}`).toBe(expected);
    }
    expect(disconnected).toBeGreaterThan(0);
  });
});

describe('the redraw really happens', { timeout: 30_000 }, () => {
  it('seed 2 raw placement leaves A1 with 60/81 reachable cells', () => {
    const raw = placeWalls(mulberry32(2));
    expect(isFullyConnected(raw)).toBe(false);
    expect(reachableCells(parseCell('A1'), raw)).toHaveLength(60);
    const fixed = placeConnectedWalls(mulberry32(2));
    expect(fixed).not.toEqual(raw);
    expect(isFullyConnected(fixed)).toBe(true);
  });

  it('several seeds among 0–999 produce a disconnected raw placement', () => {
    const bad: number[] = [];
    for (let seed = 0; seed < 1000; seed++) {
      if (!isFullyConnected(placeWalls(mulberry32(seed)))) bad.push(seed);
    }
    expect(bad).toContain(2);
    expect(bad.length).toBeGreaterThan(1);
  });

  it('a connected raw placement is returned unchanged (first draw kept)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const raw = placeWalls(mulberry32(seed));
      if (isFullyConnected(raw)) {
        expect(placeConnectedWalls(mulberry32(seed))).toEqual(raw);
      }
    }
  });
});

describe('placeConnectedWalls over 1 000 seeds', { timeout: 30_000 }, () => {
  it('always connected, valid, non-overlapping, deterministic and fast', () => {
    let total = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const t0 = performance.now();
      const walls = placeConnectedWalls(mulberry32(seed));
      total += performance.now() - t0;
      expect(walls, `seed ${seed}`).toHaveLength(WALL_COUNT);
      expect(walls.every(isValidWallShape), `seed ${seed}`).toBe(true);
      expect(wallsOverlap(walls), `seed ${seed}`).toBe(false);
      expect(isFullyConnected(walls), `seed ${seed}`).toBe(true);
      expect(ufConnected(walls), `seed ${seed}`).toBe(true);
      expect(placeConnectedWalls(mulberry32(seed)), `seed ${seed}`).toEqual(walls);
    }
    expect(total / 1000).toBeLessThan(5);
  });
});

describe('placeConnectedWalls is bounded', { timeout: 30_000 }, () => {
  it('exposes a sane attempt bound', () => {
    expect(Number.isInteger(MAX_CONNECTED_ATTEMPTS)).toBe(true);
    expect(MAX_CONNECTED_ATTEMPTS).toBeGreaterThan(0);
    expect(MAX_CONNECTED_ATTEMPTS).toBeLessThanOrEqual(100_000);
  });

  it('throws a clear error after exactly MAX_CONNECTED_ATTEMPTS disconnected draws', () => {
    // Record the values seed 2 feeds to one (disconnected) placeWalls call, then replay them
    // in a loop so that every draw yields the very same disconnected layout.
    const recorded: number[] = [];
    const src = mulberry32(2);
    const recorder: Rng = () => {
      const v = src();
      recorded.push(v);
      return v;
    };
    const layout = placeWalls(recorder);
    expect(isFullyConnected(layout)).toBe(false);

    let calls = 0;
    const replay: Rng = () => recorded[calls++ % recorded.length];
    expect(placeWalls(replay)).toEqual(layout);
    calls = 0;

    const t0 = performance.now();
    expect(() => placeConnectedWalls(replay)).toThrow(
      new RegExp(`${MAX_CONNECTED_ATTEMPTS}.*attempts|attempts.*${MAX_CONNECTED_ATTEMPTS}`),
    );
    expect(performance.now() - t0).toBeLessThan(10_000);
    expect(calls).toBe(MAX_CONNECTED_ATTEMPTS * recorded.length);
  });
});
