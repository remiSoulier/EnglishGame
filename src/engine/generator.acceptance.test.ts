/**
 * Task #16 — generator acceptance suite.
 *
 * Over 1 000 distinct board codes, all three difficulties and turns 1–3, checks every board rule
 * through the public API `generateBoard` only, with independent geometry / connectivity checks
 * (engine validators are used solely as a cross-check).
 *
 * Task #23 (decision D12) — each board holds the eight fixed pieces W1 … W8 exactly once, with
 * their side count, shape, arm lengths and (for W6 / W8) never-mirrored chirality, checked with
 * own geometry; every orientation of every piece appears across the sample.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateBoard,
  isFullyConnected,
  matchesPiece,
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

/** The fixed pieces of decision D12, written independently from the engine. */
const PIECES: Readonly<Record<string, { shape: 'straight' | 'L'; arms: number[] }>> = {
  W1: { shape: 'straight', arms: [2] },
  W2: { shape: 'straight', arms: [2] },
  W3: { shape: 'straight', arms: [3] },
  W4: { shape: 'straight', arms: [4] },
  W5: { shape: 'L', arms: [1, 1] },
  W6: { shape: 'L', arms: [2, 1] },
  W7: { shape: 'L', arms: [2, 2] },
  W8: { shape: 'L', arms: [3, 2] },
};
const PIECE_IDS = Object.keys(PIECES);

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

/** Unit step vectors along a wall listed in path order (y grows downwards). */
function stepsOf(segs: readonly Segment[]): Point[] {
  if (segs.length === 0) return [];
  const shared = (s: Segment, t: Segment): Point | undefined =>
    [s.a, s.b].find((p) => pkey(p) === pkey(t.a) || pkey(p) === pkey(t.b));
  let start: Point = segs[0].a;
  if (segs.length > 1) {
    const join = shared(segs[0], segs[1]);
    if (join && pkey(join) === pkey(segs[0].a)) start = segs[0].b;
  }
  const steps: Point[] = [];
  let cur = start;
  for (const s of segs) {
    const next = pkey(s.a) === pkey(cur) ? s.b : s.a;
    steps.push([next[0] - cur[0], next[1] - cur[1]]);
    cur = next;
  }
  return steps;
}

const dirName = (v: Point): string =>
  v[0] === 1 ? 'E' : v[0] === -1 ? 'W' : v[1] === 1 ? 'S' : 'N';

interface PieceGeometry {
  arms: number[];
  /** For an L read from the end of its longer arm (or either end if equal): +1 clockwise. */
  turn: 0 | 1 | -1;
  /** 'H' / 'V' for a straight wall; for an L the first-arm direction of its clockwise reading. */
  orientation: string;
}

/**
 * Arms, turn direction and orientation of a wall (own geometry). On screen y grows downwards,
 * so the cross product dx1·dy2 − dy1·dx2 > 0 is a clockwise (right-hand) turn, e.g. East → South.
 */
function pieceGeometry(segs: readonly Segment[]): PieceGeometry {
  let steps = stepsOf(segs);
  const arms: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (i > 0 && pkey(steps[i]) === pkey(steps[i - 1])) arms[arms.length - 1]++;
    else arms.push(1);
  }
  if (arms.length === 1) return { arms, turn: 0, orientation: segs[0].orient };
  if (arms[0] < arms[1]) {
    // Read from the other end: reverse order and direction of every step.
    steps = steps.map(([x, y]): Point => [-x, -y]).reverse();
    arms.reverse();
  }
  const s1 = steps[0];
  const s2 = steps[steps.length - 1];
  const cross = s1[0] * s2[1] - s1[1] * s2[0];
  const turn = cross > 0 ? 1 : -1;
  // Clockwise reading: for equal arms read from the other end if this reading is CCW.
  const first = turn === 1 ? s1 : ([-s2[0], -s2[1]] as Point);
  return { arms, turn, orientation: dirName(first) };
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
  pieceIds: string[];
  pieceGeometry: string[];
  mirrored: string[];
  matchesPiece: string[];
  /** Orientation counts per piece, e.g. `W6` → { E: 10, S: 12, … }. */
  orientations: Record<string, Record<string, number>>;
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
  const ids = board.walls.map((w) => w.id as string);
  if ([...ids].sort().join() !== PIECE_IDS.join()) {
    r.pieceIds.push(`${label}: ids ${ids.join(',')}`);
  } else if (ids.join() !== PIECE_IDS.join()) {
    r.pieceIds.push(`${label}: ids not in W1 … W8 order: ${ids.join(',')}`);
  }

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
    const piece = PIECES[wall.id];
    if (!piece) {
      r.pieceIds.push(`${label}: unknown piece id ${String(wall.id)}`);
    } else if (shape === 'straight' || shape === 'L') {
      const geo = pieceGeometry(segs);
      const length = piece.arms.reduce((a, b) => a + b, 0);
      const want = [...piece.arms].sort((a, b) => b - a).join('+');
      const got = [...geo.arms].sort((a, b) => b - a).join('+');
      if (n !== length || shape !== piece.shape || want !== got) {
        r.pieceGeometry.push(
          `${label}: ${wall.id} [${wall.sides.join(' ')}] ${shape} ${got}, want ${piece.shape} ${want}`,
        );
      }
      // Chirality only matters for unequal arms (W6, W8): longer arm then a clockwise turn.
      if (piece.shape === 'L' && piece.arms[0] !== piece.arms[1] && geo.turn !== 1) {
        r.mirrored.push(`${label}: ${wall.id} [${wall.sides.join(' ')}] mirrored`);
      }
      const counts = (r.orientations[wall.id] ??= {});
      counts[geo.orientation] = (counts[geo.orientation] ?? 0) + 1;
    }
    if (!matchesPiece(wall)) {
      r.matchesPiece.push(`${label}: engine matchesPiece rejects ${wall.id} [${wall.sides}]`);
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
    pieceIds: [],
    pieceGeometry: [],
    mirrored: [],
    matchesPiece: [],
    orientations: {},
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

  it('0. own piece geometry self-check on hand-made walls', () => {
    const geo = (sides: string[]): PieceGeometry => pieceGeometry(sides.map(segmentOf));
    // W6 ‾‾| : 2 East, clockwise, 1 South; from either end.
    expect(geo(['C2-S', 'D2-S', 'D3-E'])).toEqual({ arms: [2, 1], turn: 1, orientation: 'E' });
    expect(geo(['D3-E', 'D2-S', 'C2-S'])).toEqual({ arms: [2, 1], turn: 1, orientation: 'E' });
    // Mirror |‾‾ : 2 West then 1 South (counter-clockwise).
    expect(geo(['D2-S', 'C2-S', 'B3-E']).turn).toBe(-1);
    // W8 rotated: 3 North then 2 East (clockwise).
    expect(geo(['D8-E', 'D7-E', 'D6-E', 'E5-S', 'F5-S'])).toEqual({
      arms: [3, 2],
      turn: 1,
      orientation: 'N',
    });
    // W7 equal arms read counter-clockwise: orientation of its clockwise reading.
    expect(geo(['C2-S', 'D2-S', 'D2-E', 'D1-E']).orientation).toBe('S');
    expect(geo(['B4-S', 'C4-S', 'D4-S']).orientation).toBe('H');
    expect(geo(['C3-E', 'C4-E']).orientation).toBe('V');
  });

  it('uses 1 000 distinct codes and checks 9 000 boards', () => {
    expect(new Set(r.codes).size).toBe(SEEDS);
    expect(r.boards).toBe(SEEDS * DIFFICULTIES.length * (1 + LATER_TURNS.length));
  });

  it('1. exactly 8 walls, each of 2–5 sides, straight or L (own geometry)', () => {
    expect(r.wallCount).toEqual([]);
    expect(r.wallLength).toEqual([]);
    expect(r.wallShape).toEqual([]);
  });

  it('1c. pieces W1 … W8 exactly once each, in id order', () => {
    expect(r.pieceIds).toEqual([]);
  });

  it('1d. each wall has its piece side count, shape and arms (own geometry)', () => {
    expect(r.pieceGeometry).toEqual([]);
    expect(r.matchesPiece).toEqual([]);
  });

  it('1e. W6 and W8 are never mirrored (longer arm then a clockwise turn)', () => {
    expect(r.mirrored).toEqual([]);
  });

  it('1f. every orientation of every piece appears across the sample', () => {
    const expected = (id: string): string[] =>
      PIECES[id].shape === 'straight' ? ['H', 'V'] : ['E', 'N', 'S', 'W'];
    for (const id of PIECE_IDS) {
      const counts = r.orientations[id] ?? {};
      expect(Object.keys(counts).sort(), id).toEqual(expected(id));
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(total, id).toBe(r.boards);
      // Roughly uniform: each orientation gets at least a tenth of the draws.
      for (const k of expected(id)) expect(counts[k], `${id} ${k}`).toBeGreaterThan(total / 10);
    }
    process.stdout.write(`orientation counts ${JSON.stringify(r.orientations)}\n`);
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
