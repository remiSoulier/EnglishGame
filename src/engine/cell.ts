import { BOARD_SIZE, COLUMNS, START_CELLS, type Cell, type Dir } from './types';

const CELL_RE = /^([A-I])([1-9])$/;

/**
 * Returns the board name of a cell, e.g. `{ x: 2, y: 2 }` → `'C3'`.
 * @throws if the cell is outside the board.
 */
export function cellName(cell: Cell): string {
  if (!isInside(cell)) {
    throw new Error(`Cell outside the board: (${cell.x}, ${cell.y})`);
  }
  return `${COLUMNS[cell.x]}${cell.y + 1}`;
}

/** Alias of `cellName`, intended for use as a Map/Set key. */
export const cellKey = cellName;

/**
 * Parses a cell name such as `'C3'` (case-insensitive, surrounding whitespace ignored).
 * @throws if the name is not a valid cell A1–I9.
 */
export function parseCell(name: string): Cell {
  const match = CELL_RE.exec(name.trim().toUpperCase());
  if (!match) {
    throw new Error(`Invalid cell name: "${name}"`);
  }
  return { x: match[1].charCodeAt(0) - 'A'.charCodeAt(0), y: Number(match[2]) - 1 };
}

/** True if the cell has integer coordinates within the 9×9 board. */
export function isInside(cell: Cell): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.x < BOARD_SIZE &&
    cell.y >= 0 &&
    cell.y < BOARD_SIZE
  );
}

/** True if both cells have the same coordinates. */
export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Unit offsets for each direction. */
export const DIR_DELTA: Readonly<Record<Dir, Readonly<Cell>>> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

/** All directions in N, E, S, W order. */
export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

/** Opposite direction of each direction. */
export const OPPOSITE: Readonly<Record<Dir, Dir>> = { N: 'S', E: 'W', S: 'N', W: 'E' };

/** Returns the cell one step in `dir` from `cell`. The result may be outside the board. */
export function step(cell: Cell, dir: Dir): Cell {
  const d = DIR_DELTA[dir];
  return { x: cell.x + d.x, y: cell.y + d.y };
}

/** Orthogonal in-bounds neighbours of a cell, in N, E, S, W order. */
export function neighbors(cell: Cell): Cell[] {
  return DIRS.map((dir) => step(cell, dir)).filter(isInside);
}

/** True if the cell is one of the four starting corners. */
export function isStartCell(cell: Cell): boolean {
  return START_CELLS.some((start) => sameCell(start, cell));
}

/** All 81 cells in row-major order (A1, B1, …, I1, A2, …, I9). */
export function allCells(): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      cells.push({ x, y });
    }
  }
  return cells;
}
