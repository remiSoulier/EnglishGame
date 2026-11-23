import { cellName, isInside, OPPOSITE, parseCell, sameCell, step } from './cell';
import { BOARD_SIZE, type Cell, type Dir, type GridPoint, type Side, type SideKey } from './types';

const SIDE_RE = /^([A-I][1-9])-([NESWO])$/;

function assertInside(cell: Cell): void {
  if (!isInside(cell)) {
    throw new Error(`Cell outside the board: (${cell.x}, ${cell.y})`);
  }
}

function toSide(side: Side | SideKey): Side {
  return typeof side === 'string' ? parseSide(side) : side;
}

/**
 * Normalises a side to its canonical form: an `E` or `S` side of some cell.
 * `D3-W` → `C3-E`, `C4-N` → `C3-S`. Border sides on the N/W edge (no neighbour) are kept as-is.
 * @throws if the side's cell is outside the board.
 */
export function normalizeSide(side: Side): Side {
  assertInside(side.cell);
  const { cell, dir } = side;
  if ((dir === 'N' && cell.y > 0) || (dir === 'W' && cell.x > 0)) {
    return { cell: step(cell, dir), dir: OPPOSITE[dir] };
  }
  return { cell: { x: cell.x, y: cell.y }, dir };
}

/** Canonical key of a side, e.g. `{ D3, W }` → `'C3-E'`. */
export function sideKey(side: Side): SideKey {
  const n = normalizeSide(side);
  return `${cellName(n.cell)}-${n.dir}`;
}

/**
 * Parses a side string such as `C3-E` (case-insensitive; `O` is accepted as an alias of `W`).
 * The returned side is as written, not normalised — use `sideKey` / `normalizeSide` for that.
 * @throws if the string is not a valid side.
 */
export function parseSide(str: string): Side {
  const match = SIDE_RE.exec(str.trim().toUpperCase());
  if (!match) {
    throw new Error(`Invalid side: "${str}"`);
  }
  const dir = (match[2] === 'O' ? 'W' : match[2]) as Dir;
  return { cell: parseCell(match[1]), dir };
}

/**
 * Canonical key of the side shared by two orthogonally adjacent cells.
 * One of the cells may be outside the board, in which case the border side of the other is returned.
 * @throws if the cells are not orthogonally adjacent or both are outside the board.
 */
export function sideBetween(a: Cell, b: Cell): SideKey {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    throw new Error(`Cells are not orthogonally adjacent: (${a.x}, ${a.y}) and (${b.x}, ${b.y})`);
  }
  const dir: Dir = dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : 'N';
  if (isInside(a)) {
    return sideKey({ cell: a, dir });
  }
  return sideKey({ cell: b, dir: OPPOSITE[dir] });
}

/** True if the side lies on the outer border of the board (it touches a single cell). */
export function isBorderSide(side: Side | SideKey): boolean {
  const { cell, dir } = normalizeSide(toSide(side));
  switch (dir) {
    case 'N':
      return cell.y === 0;
    case 'W':
      return cell.x === 0;
    case 'E':
      return cell.x === BOARD_SIZE - 1;
    case 'S':
      return cell.y === BOARD_SIZE - 1;
  }
}

/** The cells touching a side: two for an inner side, one for a border side. */
export function cellsOfSide(side: Side | SideKey): [Cell, Cell] | [Cell] {
  const n = normalizeSide(toSide(side));
  const other = step(n.cell, n.dir);
  return isInside(other) ? [n.cell, other] : [n.cell];
}

/**
 * The two grid-corner endpoints of a side's segment, on the corner lattice (0–9 on each axis).
 * Cell (x, y) spans corners (x, y) to (x + 1, y + 1). Endpoints are ordered top-left first.
 */
export function sideEndpoints(side: Side | SideKey): [GridPoint, GridPoint] {
  const { cell, dir } = normalizeSide(toSide(side));
  const { x, y } = cell;
  switch (dir) {
    case 'N':
      return [
        { px: x, py: y },
        { px: x + 1, py: y },
      ];
    case 'S':
      return [
        { px: x, py: y + 1 },
        { px: x + 1, py: y + 1 },
      ];
    case 'W':
      return [
        { px: x, py: y },
        { px: x, py: y + 1 },
      ];
    case 'E':
      return [
        { px: x + 1, py: y },
        { px: x + 1, py: y + 1 },
      ];
  }
}

/** True if two sides are the same physical side (after normalisation). */
export function sameSide(a: Side | SideKey, b: Side | SideKey): boolean {
  const na = normalizeSide(toSide(a));
  const nb = normalizeSide(toSide(b));
  return na.dir === nb.dir && sameCell(na.cell, nb.cell);
}
