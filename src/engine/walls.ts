import { isInside } from './cell';
import { isBorderSide, parseSide, sideBetween, sideEndpoints, sideKey } from './side';
import { randInt } from './rng';
import {
  BOARD_SIZE,
  WALL_COUNT,
  type Cell,
  type GridPoint,
  type Rng,
  type SideKey,
  type Wall,
  type WallSides,
} from './types';
import { WALL_PIECES, wallPiece, type WallId, type WallPiece } from './wallPieces';

/** Minimum number of sides of a wall. */
export const WALL_MIN_LENGTH = 2;
/** Maximum number of sides of a wall. */
export const WALL_MAX_LENGTH = 5;

/** Geometric shape of a wall. */
export type WallShape = 'straight' | 'L' | 'invalid';

/** Set of the canonical side keys covered by the given walls. */
export function wallSideSet(walls: readonly WallSides[]): Set<SideKey> {
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
export function isBlocked(a: Cell, b: Cell, walls: readonly WallSides[]): boolean {
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

/** Index of a unit lattice step: 0 = N, 1 = E, 2 = S, 3 = W (clockwise). */
function stepIndex(from: GridPoint, to: GridPoint): number {
  const dx = to.px - from.px;
  const dy = to.py - from.py;
  return dy === -1 ? 0 : dx === 1 ? 1 : dy === 1 ? 2 : 3;
}

/**
 * Directions (see `stepIndex`) of the successive sides of a wall walked in stored order, or `null`
 * if a side is unparsable, repeated or on the border, or the sides do not form a single
 * contiguous polyline in the stored order. Needs at least 2 sides.
 */
function wallSteps(sides: readonly SideKey[]): number[] | null {
  if (sides.length < 2) {
    return null;
  }
  const segments: [GridPoint, GridPoint][] = [];
  const seen = new Set<SideKey>();
  for (const raw of sides) {
    let key: SideKey;
    try {
      key = sideKey(parseSide(raw));
    } catch {
      return null;
    }
    if (seen.has(key) || isBorderSide(key)) {
      return null;
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
    return null;
  }

  const steps: number[] = [stepIndex(start, current)];
  for (let i = 1; i < segments.length; i++) {
    const [a, b] = segments[i];
    let next: GridPoint;
    if (samePoint(a, current)) {
      next = b;
    } else if (samePoint(b, current)) {
      next = a;
    } else {
      return null;
    }
    steps.push(stepIndex(current, next));
    current = next;
  }
  return steps;
}

/**
 * Shape of a wall: `'straight'` (all sides collinear) or `'L'` (exactly one 90° turn), or
 * `'invalid'` when the wall breaks any rule: length outside 2–5, unparsable or repeated side,
 * border side, or sides that do not form a single contiguous polyline in the stored order.
 */
export function wallShape(wall: WallSides): WallShape {
  const { sides } = wall;
  if (sides.length < WALL_MIN_LENGTH || sides.length > WALL_MAX_LENGTH) {
    return 'invalid';
  }
  const steps = wallSteps(sides);
  if (steps === null) {
    return 'invalid';
  }
  // A reversal would reuse a side (already rejected), so every direction change is a 90° turn.
  let turns = 0;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i] !== steps[i - 1]) {
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
export function isValidWallShape(wall: WallSides): boolean {
  return wallShape(wall) !== 'invalid';
}

/** True if at least one side (after normalisation) is used by two different walls. */
export function wallsOverlap(walls: readonly WallSides[]): boolean {
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

/**
 * True if `wall` is a legal placement of its piece `wall.id` (see `WALL_PIECES`): valid shape
 * (`wallShape`), the piece's number of sides, and for an L piece its arm lengths and handedness.
 *
 * Mirror rule. An L piece `[a, b]` is canonically `a` steps, then a clockwise turn, then `b`
 * steps (y grows downwards, so East → South is clockwise). The same physical piece read from the
 * other end is `b` steps, then a counter-clockwise turn, then `a` steps. So, walking the sides in
 * stored order with first arm `k`, second arm `m` and turn direction `t`, the wall matches when
 * `(k, m, t) = (a, b, clockwise)` or `(b, a, counter-clockwise)`; any of the 4 rotations is
 * allowed. The mirrored piece (`a`, counter-clockwise, `b`, i.e. `b`, clockwise, `a`) is rejected
 * when `a ≠ b`. For `a = b` (W5, W7) the mirror image is itself a rotation, so every L with equal
 * arms of the right length matches. `placeWalls` always stores L walls in canonical reading
 * (first arm `a`, clockwise turn) and straight walls from their top / left end.
 */
export function matchesPiece(wall: Wall): boolean {
  const piece = wallPiece(wall.id);
  if (piece === undefined || wall.sides.length !== piece.length) {
    return false;
  }
  const shape = wallShape(wall);
  if (shape !== piece.shape) {
    return false;
  }
  if (piece.shape === 'straight') {
    return true;
  }
  const steps = wallSteps(wall.sides);
  if (steps === null) {
    return false;
  }
  let first = 1;
  while (steps[first] === steps[0]) {
    first++;
  }
  const second = steps.length - first;
  const turn = (steps[first] - steps[0] + 4) % 4;
  const [a, b] = piece.arms as readonly [number, number];
  return (first === a && second === b && turn === 1) || (first === b && second === a && turn === 3);
}

/**
 * Order in which `placeWalls` lays the pieces: largest and least flexible first, so that the
 * small pieces fill the remaining gaps (fewer layout restarts). Walls are returned in id order.
 */
export const WALL_PLACEMENT_ORDER: readonly WallId[] = Object.freeze([
  'W8',
  'W7',
  'W4',
  'W6',
  'W3',
  'W5',
  'W1',
  'W2',
]);

/** Unit steps on the corner lattice, indexed N, E, S, W (clockwise, see `stepIndex`). */
const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Draws of one piece (orientation + anchor) before the whole layout restarts. */
const MAX_TRIES_PER_PIECE = 100;
/** Layouts started by `placeWalls` before it gives up. */
const MAX_LAYOUT_ATTEMPTS = 1000;

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
 * Step directions of each orientation of a piece. Straight: horizontal (E) then vertical (S).
 * L: rotations 0–3, first arm E, S, W, N, each followed by a clockwise turn.
 */
function orientations(piece: WallPiece): number[][] {
  if (piece.shape === 'straight') {
    return [1, 2].map((d) => Array<number>(piece.length).fill(d));
  }
  const [a, b] = piece.arms as readonly [number, number];
  return [1, 2, 3, 0].map((d1) => [
    ...Array<number>(a).fill(d1),
    ...Array<number>(b).fill((d1 + 1) % 4),
  ]);
}

/**
 * Every legal placement of a piece, grouped by orientation: for each anchor lattice point (in
 * row-major order) from which the path stays on inner sides, its side keys in path order.
 */
function placementsOf(piece: WallPiece): SideKey[][][] {
  return orientations(piece).map((dirs) => {
    const result: SideKey[][] = [];
    for (let py = 0; py <= BOARD_SIZE; py++) {
      for (let px = 0; px <= BOARD_SIZE; px++) {
        let point: GridPoint = { px, py };
        const keys: SideKey[] = [];
        for (const d of dirs) {
          const next = { px: point.px + STEPS[d][0], py: point.py + STEPS[d][1] };
          const key = innerSideKey(point, next);
          if (key === null) {
            break;
          }
          keys.push(key);
          point = next;
        }
        if (keys.length === dirs.length) {
          result.push(keys);
        }
      }
    }
    return result;
  });
}

/** Legal placements of each piece, in `WALL_PLACEMENT_ORDER`. */
const PLACEMENTS: readonly { id: WallId; byOrientation: SideKey[][][] }[] =
  WALL_PLACEMENT_ORDER.map((id) => ({
    id,
    byOrientation: placementsOf(WALL_PIECES.find((p) => p.id === id) as WallPiece),
  }));

const ID_RANK: ReadonlyMap<WallId, number> = new Map(WALL_PIECES.map((p, i) => [p.id, i]));

/**
 * Lays the `WALL_COUNT` fixed pieces of `WALL_PIECES`, each exactly once, on random places.
 *
 * Pieces are laid in `WALL_PLACEMENT_ORDER`. For each piece, one draw = a uniform orientation
 * (`randInt`: 2 for a straight piece, 4 rotations for an L piece) then a uniform anchor among the
 * anchors where that orientation stays on inner sides (`randInt`), i.e. never on or past the
 * border. A draw that shares a side with an already laid piece is redrawn (touching at a corner
 * is allowed); after `MAX_TRIES_PER_PIECE` failed draws the whole layout restarts.
 *
 * Each wall is `{ id, sides }` with canonical keys in path order (see `matchesPiece`); walls are
 * returned in id order W1 … W8. Deterministic for a given `rng` sequence. Connectivity is not
 * checked here (see `placeConnectedWalls`).
 * @throws if no layout is found after `MAX_LAYOUT_ATTEMPTS` attempts (should never happen).
 */
export function placeWalls(rng: Rng): Wall[] {
  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt++) {
    const used = new Set<SideKey>();
    const walls: Wall[] = [];
    for (const { id, byOrientation } of PLACEMENTS) {
      let sides: SideKey[] | null = null;
      for (let tries = 0; tries < MAX_TRIES_PER_PIECE && sides === null; tries++) {
        const options = byOrientation[randInt(rng, 0, byOrientation.length - 1)];
        const candidate = options[randInt(rng, 0, options.length - 1)];
        if (candidate.every((key) => !used.has(key))) {
          sides = candidate;
        }
      }
      if (sides === null) {
        break;
      }
      for (const key of sides) {
        used.add(key);
      }
      walls.push({ id, sides: sides.slice() });
    }
    if (walls.length === WALL_COUNT) {
      return walls.sort((a, b) => (ID_RANK.get(a.id) ?? 0) - (ID_RANK.get(b.id) ?? 0));
    }
  }
  throw new Error(
    `Could not lay the ${WALL_COUNT} wall pieces after ${MAX_LAYOUT_ATTEMPTS} attempts`,
  );
}
