import { cellName, isInside } from './cell';
import { BOARD_SIZE, type Cell, type SideKey, type Wall } from './types';
import { wallSideSet } from './walls';

const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

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

/** BFS from cell index `start`; returns the visited flags and the number of visited cells. */
function flood(start: number, blocked: ReadonlySet<SideKey>): { seen: Uint8Array; count: number } {
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
  return { seen, count: tail };
}

/**
 * Cells reachable from `from` by orthogonal moves that do not cross a wall, in BFS order
 * starting with `from` itself.
 * @throws if `from` is outside the board.
 */
export function reachableCells(from: Cell, walls: readonly Wall[]): Cell[] {
  if (!isInside(from)) {
    throw new Error(`Cell outside the board: (${from.x}, ${from.y})`);
  }
  const { seen } = flood(from.y * BOARD_SIZE + from.x, wallSideSet(walls));
  const cells: Cell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (seen[i] === 1) {
      cells.push({ x: i % BOARD_SIZE, y: Math.floor(i / BOARD_SIZE) });
    }
  }
  return cells;
}

/** True if all 81 cells are reachable from A1 (hence from any cell) without crossing a wall. */
export function isFullyConnected(walls: readonly Wall[]): boolean {
  return flood(0, wallSideSet(walls)).count === CELL_COUNT;
}
