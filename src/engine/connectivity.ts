import { cellName, isInside } from './cell';
import { BOARD_SIZE, type Cell, type Rng, type SideKey, type Wall, type WallSides } from './types';
import { placeWalls, wallSideSet } from './walls';

const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** Maximum number of `placeWalls` draws tried by `placeConnectedWalls` before giving up. */
export const MAX_CONNECTED_ATTEMPTS = 10_000;

/** Canonical key of the E side of each cell (index `y * BOARD_SIZE + x`); empty on column I. */
const EAST_KEYS: readonly SideKey[] = Array.from({ length: CELL_COUNT }, (_, i) => {
  const x = i % BOARD_SIZE;
  return x < BOARD_SIZE - 1 ? `${cellName({ x, y: Math.floor(i / BOARD_SIZE) })}-E` : '';
});

/** Canonical key of the S side of each cell (index `y * BOARD_SIZE + x`); empty on row 9. */
const SOUTH_KEYS: readonly SideKey[] = Array.from({ length: CELL_COUNT }, (_, i) => {
  const y = Math.floor(i / BOARD_SIZE);
  return y < BOARD_SIZE - 1 ? `${cellName({ x: i % BOARD_SIZE, y })}-S` : '';
});

/**
 * BFS from cell index `start`; returns the visited cell indices in BFS order (`order`, valid up
 * to `count`) and the number of visited cells.
 */
function flood(start: number, blocked: ReadonlySet<SideKey>): { order: Int32Array; count: number } {
  const seen = new Uint8Array(CELL_COUNT);
  const queue = new Int32Array(CELL_COUNT);
  let head = 0;
  let tail = 0;
  seen[start] = 1;
  queue[tail++] = start;
  const visit = (next: number, key: SideKey): void => {
    if (seen[next] === 0 && !blocked.has(key)) {
      seen[next] = 1;
      queue[tail++] = next;
    }
  };
  while (head < tail) {
    const i = queue[head++];
    const x = i % BOARD_SIZE;
    const y = (i - x) / BOARD_SIZE;
    if (y > 0) visit(i - BOARD_SIZE, SOUTH_KEYS[i - BOARD_SIZE]);
    if (x < BOARD_SIZE - 1) visit(i + 1, EAST_KEYS[i]);
    if (y < BOARD_SIZE - 1) visit(i + BOARD_SIZE, SOUTH_KEYS[i]);
    if (x > 0) visit(i - 1, EAST_KEYS[i - 1]);
  }
  return { order: queue, count: tail };
}

/**
 * Cells reachable from `from` by orthogonal moves that do not cross a wall, in BFS order
 * starting with `from` itself.
 * @throws if `from` is outside the board.
 */
export function reachableCells(from: Cell, walls: readonly WallSides[]): Cell[] {
  if (!isInside(from)) {
    throw new Error(`Cell outside the board: (${from.x}, ${from.y})`);
  }
  const { order, count } = flood(from.y * BOARD_SIZE + from.x, wallSideSet(walls));
  const cells: Cell[] = [];
  for (let k = 0; k < count; k++) {
    const i = order[k];
    cells.push({ x: i % BOARD_SIZE, y: Math.floor(i / BOARD_SIZE) });
  }
  return cells;
}

/** True if all 81 cells are reachable from A1 (hence from any cell) without crossing a wall. */
export function isFullyConnected(walls: readonly WallSides[]): boolean {
  return flood(0, wallSideSet(walls)).count === CELL_COUNT;
}

/**
 * Draws walls with `placeWalls` until the board is fully connected (no isolated cell or zone).
 * Deterministic for a given `rng` sequence.
 * @throws if no connected layout is found after `MAX_CONNECTED_ATTEMPTS` draws.
 */
export function placeConnectedWalls(rng: Rng): Wall[] {
  for (let attempt = 0; attempt < MAX_CONNECTED_ATTEMPTS; attempt++) {
    const walls = placeWalls(rng);
    if (isFullyConnected(walls)) {
      return walls;
    }
  }
  throw new Error(`Could not place fully connected walls after ${MAX_CONNECTED_ATTEMPTS} attempts`);
}
