import { isInside } from './cell';
import { isBorderSide, parseSide, sideBetween, sideEndpoints, sideKey } from './side';
import {
  BOARD_SIZE,
  WALL_COUNT,
  type Cell,
  type GridPoint,
  type Rng,
  type SideKey,
  type Wall,
} from './types';

/** Minimum number of sides of a wall. */
export const WALL_MIN_LENGTH = 2;
/** Maximum number of sides of a wall. */
export const WALL_MAX_LENGTH = 5;

/** Geometric shape of a wall. */
export type WallShape = 'straight' | 'L' | 'invalid';

/** Set of the canonical side keys covered by the given walls. */
export function wallSideSet(walls: readonly Wall[]): Set<SideKey> {
  const set = new Set<SideKey>();
  for (const wall of walls) {
    for (const key of wall.sides) {
      set.add(sideKey(parseSide(key)));
    }
  }
  return set;
}

/**
 * True if moving from `a` to the orthogonally adjacent cell `b` is impossible: either a wall
 * lies on the side between them, or `b` is outside the board.
 * @throws if `a` is outside the board or `a` and `b` are not orthogonally adjacent.
 */
export function isBlocked(a: Cell, b: Cell, walls: readonly Wall[]): boolean {
  if (!isInside(a)) {
    throw new Error(`Cell outside the board: (${a.x}, ${a.y})`);
  }
  const key = sideBetween(a, b);
  if (!isInside(b)) {
    return true;
  }
  return wallSideSet(walls).has(key);
}

function samePoint(a: GridPoint, b: GridPoint): boolean {
  return a.px === b.px && a.py === b.py;
}

/**
 * Shape of a wall: `'straight'` (all sides collinear) or `'L'` (exactly one 90° turn), or
 * `'invalid'` when the wall breaks any rule: length outside 2–5, unparsable or repeated side,
 * border side, or sides that do not form a single contiguous polyline in the stored order.
 */
export function wallShape(wall: Wall): WallShape {
  const { sides } = wall;
  if (sides.length < WALL_MIN_LENGTH || sides.length > WALL_MAX_LENGTH) {
    return 'invalid';
  }
  const segments: [GridPoint, GridPoint][] = [];
  const seen = new Set<SideKey>();
  for (const raw of sides) {
    let key: SideKey;
    try {
      key = sideKey(parseSide(raw));
    } catch {
      return 'invalid';
    }
    if (seen.has(key) || isBorderSide(key)) {
      return 'invalid';
    }
    seen.add(key);
    segments.push(sideEndpoints(key));
  }

  // Orient the first segment so that its end is the point shared with the second segment.
  const [a0, b0] = segments[0];
  const [a1, b1] = segments[1];
  let start: GridPoint;
  let current: GridPoint;
  if (samePoint(b0, a1) || samePoint(b0, b1)) {
    start = a0;
    current = b0;
  } else if (samePoint(a0, a1) || samePoint(a0, b1)) {
    start = b0;
    current = a0;
  } else {
    return 'invalid';
  }

  const dirs: string[] = [`${current.px - start.px},${current.py - start.py}`];
  for (let i = 1; i < segments.length; i++) {
    const [a, b] = segments[i];
    let next: GridPoint;
    if (samePoint(a, current)) {
      next = b;
    } else if (samePoint(b, current)) {
      next = a;
    } else {
      return 'invalid';
    }
    dirs.push(`${next.px - current.px},${next.py - current.py}`);
    current = next;
  }

  // A reversal would reuse a side (already rejected), so every direction change is a 90° turn.
  let turns = 0;
  for (let i = 1; i < dirs.length; i++) {
    if (dirs[i] !== dirs[i - 1]) {
      turns++;
    }
  }
  if (turns === 0) {
    return 'straight';
  }
  return turns === 1 ? 'L' : 'invalid';
}

/**
 * True if the wall is a valid straight or L-shaped wall of 2–5 contiguous, distinct, non-border
 * sides stored in order along the wall.
 */
export function isValidWallShape(wall: Wall): boolean {
  return wallShape(wall) !== 'invalid';
}

/** True if at least one side (after normalisation) is used by two different walls. */
export function wallsOverlap(walls: readonly Wall[]): boolean {
  const owner = new Map<SideKey, number>();
  for (let i = 0; i < walls.length; i++) {
    for (const raw of walls[i].sides) {
      const key = sideKey(parseSide(raw));
      const prev = owner.get(key);
      if (prev !== undefined && prev !== i) {
        return true;
      }
      owner.set(key, i);
    }
  }
  return false;
}

/** Unit steps on the corner lattice, indexed N, E, S, W (clockwise). */
const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const MAX_TRIES_PER_WALL = 200;
const MAX_ATTEMPTS = 1000;

/**
 * Canonical key of the inner side between lattice points `a` and `b` (one unit apart), or
 * `null` if that segment lies outside the board or on its border.
 */
function innerSideKey(a: GridPoint, b: GridPoint): SideKey | null {
  const px = Math.min(a.px, b.px);
  const py = Math.min(a.py, b.py);
  if (a.py === b.py) {
    // Horizontal segment (px, py)–(px + 1, py): S side of cell (px, py - 1).
    if (py <= 0 || py >= BOARD_SIZE || px < 0 || px >= BOARD_SIZE) {
      return null;
    }
    return sideKey({ cell: { x: px, y: py - 1 }, dir: 'S' });
  }
  // Vertical segment (px, py)–(px, py + 1): E side of cell (px - 1, py).
  if (px <= 0 || px >= BOARD_SIZE || py < 0 || py >= BOARD_SIZE) {
    return null;
  }
  return sideKey({ cell: { x: px - 1, y: py }, dir: 'E' });
}

/**
 * Draws one random straight or L candidate wall and returns its side keys in order, or `null`
 * if it leaves the board, runs along the border or reuses a side from `used`.
 */
function tryWall(rng: Rng, used: ReadonlySet<SideKey>): SideKey[] | null {
  const length = WALL_MIN_LENGTH + Math.floor(rng() * (WALL_MAX_LENGTH - WALL_MIN_LENGTH + 1));
  const isL = rng() < 0.5;
  const firstArm = isL ? 1 + Math.floor(rng() * (length - 1)) : length;
  const dir1 = Math.floor(rng() * 4);
  const dir2 = (dir1 + (rng() < 0.5 ? 1 : 3)) % 4;
  let point: GridPoint = {
    px: Math.floor(rng() * (BOARD_SIZE + 1)),
    py: Math.floor(rng() * (BOARD_SIZE + 1)),
  };
  const keys: SideKey[] = [];
  for (let i = 0; i < length; i++) {
    const [dx, dy] = STEPS[i < firstArm ? dir1 : dir2];
    const next = { px: point.px + dx, py: point.py + dy };
    const key = innerSideKey(point, next);
    if (key === null || used.has(key)) {
      return null;
    }
    keys.push(key);
    point = next;
  }
  return keys;
}

/**
 * Places `WALL_COUNT` random walls: each straight or L-shaped, 2–5 sides, no border side, no
 * side shared between walls (walls may touch at a lattice point). Sides are canonical keys
 * ordered from one end of the wall to the other. Deterministic for a given `rng` sequence.
 * A wall that does not fit is redrawn; if one wall still fails after a bounded number of
 * draws, the whole layout restarts.
 * @throws if no layout is found after a bounded number of attempts (should never happen).
 */
export function placeWalls(rng: Rng): Wall[] {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const used = new Set<SideKey>();
    const walls: Wall[] = [];
    while (walls.length < WALL_COUNT) {
      let sides: SideKey[] | null = null;
      for (let tries = 0; tries < MAX_TRIES_PER_WALL && sides === null; tries++) {
        sides = tryWall(rng, used);
      }
      if (sides === null) {
        break;
      }
      for (const key of sides) {
        used.add(key);
      }
      walls.push({ sides });
    }
    if (walls.length === WALL_COUNT) {
      return walls;
    }
  }
  throw new Error(`Could not place ${WALL_COUNT} walls after ${MAX_ATTEMPTS} attempts`);
}
