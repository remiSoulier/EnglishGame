import { rngFor, normalizeCode } from './boardCode';
import { allCells, cellName, isInside, isStartCell, sameCell } from './cell';
import { placeConnectedWalls } from './connectivity';
import { pick, randInt } from './rng';
import {
  ENEMY_COUNT,
  START_CELLS,
  type Board,
  type Cell,
  type Difficulty,
  type Rng,
} from './types';

/**
 * Board generation: goal, enemies and the full deterministic board of a turn.
 *
 * Draw order for `generateBoard(code, turn, …)`, all from `rngFor(code, turn)`:
 *   1. walls  — `placeConnectedWalls(rng)` (the 8 fixed pieces W1–W8, board fully connected);
 *   2. goal   — `placeGoal(rng)`, drawn on turn 1 only (the draw is consumed on turn 1 even when a
 *               goal is passed in, so turn 1 is identical with or without its own goal);
 *   3. enemies — `placeEnemies(rng, ENEMY_COUNT[difficulty], goal)`.
 *
 * The goal is never unreachable: walls are only accepted when every cell is reachable from every
 * other cell (`isFullyConnected`), so the goal is reachable from each start cell.
 */

/** Cells allowed for the goal: every cell except the four start corners (row-major order). */
const GOAL_CANDIDATES: readonly Cell[] = Object.freeze(allCells().filter((c) => !isStartCell(c)));

/** Uniformly random cell that is not a start cell. Consumes exactly one `rng()` value. */
export function placeGoal(rng: Rng): Cell {
  const cell = pick(rng, GOAL_CANDIDATES);
  return { x: cell.x, y: cell.y };
}

function assertValidGoal(goal: Cell): void {
  if (!isInside(goal)) {
    throw new Error(`Goal outside the board: (${goal.x}, ${goal.y})`);
  }
  if (isStartCell(goal)) {
    throw new Error(`Goal on a start cell: ${cellName(goal)}`);
  }
}

/**
 * `count` distinct cells chosen uniformly among cells that are neither the goal nor a start cell
 * (partial Fisher–Yates over the row-major candidate list; consumes exactly `count` values).
 * @throws if `count` is not an integer in [0, number of candidates] or `goal` is invalid.
 */
export function placeEnemies(rng: Rng, count: number, goal: Cell): Cell[] {
  assertValidGoal(goal);
  const candidates = GOAL_CANDIDATES.filter((c) => !sameCell(c, goal)).map((c) => ({ ...c }));
  if (!Number.isInteger(count) || count < 0 || count > candidates.length) {
    throw new Error(`Invalid enemy count: ${count}`);
  }
  for (let i = 0; i < count; i++) {
    const j = randInt(rng, i, candidates.length - 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, count);
}

/**
 * Deterministic board for a code, turn and difficulty (same arguments → same board everywhere).
 *
 * - `goal` given: kept exactly (validated, copied). Pass the turn-1 goal on later turns.
 * - `goal` omitted on turn 1: drawn from the turn-1 sequence.
 * - `goal` omitted on a later turn: the turn-1 goal is re-derived, so the goal stays fixed and a
 *   device joining mid-game only needs the code and the turn number.
 *
 * @throws on an invalid code, a turn that is not an integer ≥ 1, an unknown difficulty, or a goal
 *   off the board / on a start cell.
 */
export function generateBoard(
  code: string,
  turn: number,
  difficulty: Difficulty,
  goal?: Cell,
): Board {
  const canonical = normalizeCode(code);
  if (canonical === null) {
    throw new Error(`Invalid board code: ${code}`);
  }
  if (!Number.isInteger(turn) || turn < 1) {
    throw new Error(`Invalid turn: ${turn}`);
  }
  if (!Object.prototype.hasOwnProperty.call(ENEMY_COUNT, difficulty)) {
    throw new Error(`Invalid difficulty: ${String(difficulty)}`);
  }
  if (goal !== undefined) {
    assertValidGoal(goal);
  }

  const rng = rngFor(canonical, turn);
  const walls = placeConnectedWalls(rng);
  let fixedGoal: Cell;
  if (turn === 1) {
    const drawn = placeGoal(rng);
    fixedGoal = goal === undefined ? drawn : { x: goal.x, y: goal.y };
  } else {
    fixedGoal =
      goal === undefined ? generateBoard(canonical, 1, difficulty).goal : { x: goal.x, y: goal.y };
  }
  const enemies = placeEnemies(rng, ENEMY_COUNT[difficulty], fixedGoal);
  return { code: canonical, turn, difficulty, walls, enemies, goal: fixedGoal };
}

/**
 * Start cells used by a game with `playerCount` players: the first N of `START_CELLS`
 * (P1 = A1, P2 = I9, P3 = I1, P4 = A9).
 * @throws if `playerCount` is not 2, 3 or 4.
 */
export function startCellsFor(playerCount: 2 | 3 | 4): Cell[] {
  if (playerCount !== 2 && playerCount !== 3 && playerCount !== 4) {
    throw new Error(`Invalid player count: ${String(playerCount)}`);
  }
  return START_CELLS.slice(0, playerCount).map((c) => ({ x: c.x, y: c.y }));
}
