/**
 * Task #16 — generator acceptance suite.
 *
 * Over 1 000 distinct board codes, all three difficulties and turns 1–3, checks every board rule
 * through the public API `generateBoard` only, with independent geometry / connectivity checks
 * (engine validators are used solely as a cross-check).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateBoard,
  isFullyConnected,
  mulberry32,
  newCode,
  wallShape,
  wallsOverlap,
  type Board,
  type Cell,
  type Difficulty,
} from './index';

const SEEDS = 1000;
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
const EXPECTED_ENEMIES: Readonly<Record<Difficulty, number>> = { easy: 2, medium: 4, hard: 6 };
const LATER_TURNS = [2, 3] as const;
const N = 9;

// ---------------------------------------------------------------------------------------------
// Independent geometry helpers (no engine code).
// ---------------------------------------------------------------------------------------------

type Point = readonly [number, number];
interface Segment {
  /** 'H' (horizontal) or 'V' (vertical). */
  orient: 'H' | 'V';
  a: Point;
  b: Point;
  key: string;
}

/** Parses `C3-E` (N/E/S/W, O = W) into the lattice segment it denotes. Corners range 0–9. */
function segmentOf(side: string): Segment {
  const m = /^([A-I])([1-9])-([NESWO])$/.exec(side);
  if (!m) throw new Error(`unparseable side "${side}"`);
  const x = m[1].charCodeAt(0) - 65;
  const y = Number(m[2]) - 1;
  let a: Point;
  let b: Point;
  switch (m[3]) {
    case 'N':
      [a, b] = [
        [x, y],
        [x + 1, y],
      ];
      break;
    case 'S':
      [a, b] = [
        [x, y + 1],
        [x + 1, y + 1],
      ];
      break;
    case 'E':
      [a, b] = [
        [x + 1, y],
        [x + 1, y + 1],
      ];
      break;
    default:
      [a, b] = [
        [x, y],
        [x, y + 1],
      ];
  }
  const orient = a[1] === b[1] ? 'H' : 'V';
  return { orient, a, b, key: `${orient}${a[0]},${a[1]}` };
}

const pkey = (p: Point): string => `${p[0]},${p[1]}`;

function isBorderSegment(s: Segment): boolean {
  return s.orient === 'H' ? s.a[1] === 0 || s.a[1] === N : s.a[0] === 0 || s.a[0] === N;
}

/**
 * Shape of a wall from its segments: 'straight' (0 turns), 'L' (1 turn) or a reason it is invalid.
 * Requires the segments to form one simple path, listed in path order.
 */
function shapeOf(segs: readonly Segment[]): string {
  const degree = new Map<string, number>();
  for (const s of segs) {
    for (const p of [s.a, s.b]) degree.set(pkey(p), (degree.get(pkey(p)) ?? 0) + 1);
  }
  const degs = [...degree.values()];
  if (degree.size !== segs.length + 1) return 'not a simple path (point count)';
  if (degs.filter((d) => d === 1).length !== 2 || degs.some((d) => d > 2)) {
    return 'not a simple path (degrees)';
  }
  for (let i = 1; i < segs.length; i++) {
    const prev = [pkey(segs[i - 1].a), pkey(segs[i - 1].b)];
    if (![pkey(segs[i].a), pkey(segs[i].b)].some((p) => prev.includes(p))) {
      return 'sides not listed in path order';
    }
  }
  let turns = 0;
  for (let i = 1; i < segs.length; i++) if (segs[i].orient !== segs[i - 1].orient) turns++;
  return turns === 0 ? 'straight' : turns === 1 ? 'L' : `${turns} turns`;
}

/** Number of connected components of the 81 cells, using union-find with the wall segments. */
function componentCount(blocked: ReadonlySet<string>): number {
  const parent = Array.from({ length: N * N }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i: number, j: number): void => {
    parent[find(i)] = find(j);
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // East neighbour: shared vertical segment at px = x + 1, from py = y.
      if (x + 1 < N && !blocked.has(`V${x + 1},${y}`)) union(y * N + x, y * N + x + 1);
      // South neighbour: shared horizontal segment at py = y + 1, from px = x.
      if (y + 1 < N && !blocked.has(`H${x},${y + 1}`)) union(y * N + x, (y + 1) * N + x);
    }
  }
  return new Set(parent.map((_, i) => find(i))).size;
}

const ckey = (c: Cell): string => `${c.x},${c.y}`;
const inBoard = (c: Cell): boolean =>
  Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.x < N && c.y >= 0 && c.y < N;
const isCorner = (c: Cell): boolean => (c.x === 0 || c.x === N - 1) && (c.y === 0 || c.y === N - 1);

/** Lowercase, dash removed, spaces inserted: `K7F2-9QX` → ` k7 f29 qx `. */
function messyCode(code: string): string {
  const raw = code.replace('-', '').toLowerCase();
  return ` ${raw.slice(0, 2)} ${raw.slice(2, 5)} ${raw.slice(5)} `;
}

// ---------------------------------------------------------------------------------------------
// One pass over every (code, difficulty, turn) — results collected, then asserted per criterion.
// ---------------------------------------------------------------------------------------------

interface Results {
  codes: string[];
  boards: number;
  calls: number;
  wallCount: string[];
  wallLength: string[];
  wallShape: string[];
  shapeCrossCheck: string[];
  overlap: string[];
  border: string[];
  connectivity: string[];
  enemies: string[];
  goal: string[];
  determinism: string[];
  maxMs: number;
  meanMs: number;
}

function timed(fn: () => Board, r: { total: number; max: number; calls: number }): Board {
  const t0 = performance.now();
  const board = fn();
  const dt = performance.now() - t0;
  r.total += dt;
  r.max = Math.max(r.max, dt);
  r.calls++;
  return board;
}

function checkBoard(board: Board, label: string, difficulty: Difficulty, r: Results): void {
  r.boards++;
  if (board.walls.length !== 8) r.wallCount.push(`${label}: ${board.walls.length} walls`);

  const used = new Map<string, number>();
  board.walls.forEach((wall, w) => {
    const n = wall.sides.length;
    if (n < 2 || n > 5) r.wallLength.push(`${label}: wall ${w} has ${n} sides`);
    let segs: Segment[];
    try {
      segs = wall.sides.map(segmentOf);
    } catch (e) {
      r.wallShape.push(`${label}: ${(e as Error).message}`);
      return;
    }
    const shape = shapeOf(segs);
    if (shape !== 'straight' && shape !== 'L') {
      r.wallShape.push(`${label}: wall ${w} [${wall.sides.join(' ')}] ${shape}`);
    }
    const engineShape = wallShape(wall);
    if ((shape === 'straight' || shape === 'L') !== (engineShape !== 'invalid')) {
      r.shapeCrossCheck.push(`${label}: mine=${shape} engine=${engineShape}`);
    }
    for (const s of segs) {
      if (isBorderSegment(s)) r.border.push(`${label}: wall ${w} border side ${s.key}`);
      const prev = used.get(s.key);
      if (prev !== undefined) r.overlap.push(`${label}: walls ${prev} & ${w} share ${s.key}`);
      else used.set(s.key, w);
    }
  });
  if (wallsOverlap(board.walls) !== r.overlap.some((p) => p.startsWith(`${label}:`))) {
    r.overlap.push(`${label}: engine wallsOverlap disagrees`);
  }

  const components = componentCount(new Set(used.keys()));
  if (components !== 1) r.connectivity.push(`${label}: ${components} components`);
  if (isFullyConnected(board.walls) !== (components === 1)) {
    r.connectivity.push(`${label}: engine isFullyConnected disagrees`);
  }

  const { goal, enemies } = board;
  if (!inBoard(goal) || isCorner(goal)) r.goal.push(`${label}: bad goal ${ckey(goal)}`);
  if (enemies.length !== EXPECTED_ENEMIES[difficulty]) {
    r.enemies.push(`${label}: ${enemies.length} enemies`);
  }
  const seen = new Set<string>();
  for (const e of enemies) {
    if (!inBoard(e)) r.enemies.push(`${label}: enemy off board ${ckey(e)}`);
    if (isCorner(e)) r.enemies.push(`${label}: enemy on start ${ckey(e)}`);
    if (ckey(e) === ckey(goal)) r.enemies.push(`${label}: enemy on goal`);
    if (seen.has(ckey(e))) r.enemies.push(`${label}: duplicate enemy ${ckey(e)}`);
    seen.add(ckey(e));
  }
}

function runAll(): Results {
  const r: Results = {
    codes: [],
    boards: 0,
    calls: 0,
    wallCount: [],
    wallLength: [],
    wallShape: [],
    shapeCrossCheck: [],
    overlap: [],
    border: [],
    connectivity: [],
    enemies: [],
    goal: [],
    determinism: [],
    maxMs: 0,
    meanMs: 0,
  };
  const t = { total: 0, max: 0, calls: 0 };

  for (let i = 0; i < SEEDS; i++) {
    const code = newCode(mulberry32(i));
    r.codes.push(code);
    DIFFICULTIES.forEach((difficulty, d) => {
      const label1 = `${code}/${difficulty}/t1`;
      const first = timed(() => generateBoard(code, 1, difficulty), t);
      checkBoard(first, label1, difficulty, r);
      const goal = first.goal;

      for (const turn of LATER_TURNS) {
        const label = `${code}/${difficulty}/t${turn}`;
        const board = timed(() => generateBoard(code, turn, difficulty, goal), t);
        checkBoard(board, label, difficulty, r);
        if (ckey(board.goal) !== ckey(goal)) {
          r.goal.push(`${label}: goal ${ckey(board.goal)} ≠ turn-1 goal ${ckey(goal)}`);
        }
        // Goal omitted on a later turn: must be re-derived to the turn-1 goal, same board.
        if (d === i % 3 && turn === 2) {
          const rederived = timed(() => generateBoard(code, turn, difficulty), t);
          if (JSON.stringify(rederived) !== JSON.stringify(board)) {
            r.goal.push(`${label}: board without goal ≠ board with turn-1 goal`);
          }
        }
      }

      // Determinism: identical call, and messy (lowercase + spaces) code → deep-equal board.
      if (d === i % 3) {
        const again = timed(() => generateBoard(code, 1, difficulty), t);
        if (JSON.stringify(again) !== JSON.stringify(first)) {
          r.determinism.push(`${label1}: repeated call differs`);
        }
        const messy = timed(() => generateBoard(messyCode(code), 1, difficulty), t);
        if (JSON.stringify(messy) !== JSON.stringify(first)) {
          r.determinism.push(`${label1}: "${messyCode(code)}" gives a different board`);
        }
        const later = timed(() => generateBoard(messyCode(code), 3, difficulty, goal), t);
        const laterRef = generateBoard(code, 3, difficulty, goal);
        if (JSON.stringify(later) !== JSON.stringify(laterRef)) {
          r.determinism.push(`${code}/${difficulty}/t3: messy code gives a different board`);
        }
      }
    });
  }
  r.calls = t.calls;
  r.maxMs = t.max;
  r.meanMs = t.total / t.calls;
  return r;
}

describe('generator acceptance — 1 000 seeds × 3 difficulties × turns 1–3', () => {
  let r: Results;

  beforeAll(() => {
    r = runAll();
  }, 120_000);

  it('uses 1 000 distinct codes and checks 9 000 boards', () => {
    expect(new Set(r.codes).size).toBe(SEEDS);
    expect(r.boards).toBe(SEEDS * DIFFICULTIES.length * (1 + LATER_TURNS.length));
  });

  it('1. exactly 8 walls, each of 2–5 sides, straight or L (own geometry)', () => {
    expect(r.wallCount).toEqual([]);
    expect(r.wallLength).toEqual([]);
    expect(r.wallShape).toEqual([]);
  });

  it('1b. own shape check agrees with the engine wallShape', () => {
    expect(r.shapeCrossCheck).toEqual([]);
  });

  it('2. no side shared by two walls, no border side', () => {
    expect(r.overlap).toEqual([]);
    expect(r.border).toEqual([]);
  });

  it('3. every board is fully connected (own union-find, cross-checked)', () => {
    expect(r.connectivity).toEqual([]);
  });

  it('4. enemies 2/4/6, distinct, off goal and start cells; goal valid and fixed across turns', () => {
    expect(r.enemies).toEqual([]);
    expect(r.goal).toEqual([]);
  });

  it('5. determinism: same inputs and lowercase/spaced codes give deep-equal boards', () => {
    expect(r.determinism).toEqual([]);
  });

  it('6. every generateBoard call takes < 1 000 ms, mean well below', () => {
    expect(r.calls).toBeGreaterThan(9000);
    expect(r.maxMs).toBeLessThan(1000);
    expect(r.meanMs).toBeLessThan(50);
  });
});
