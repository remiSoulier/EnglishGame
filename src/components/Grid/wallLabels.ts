import { BOARD_SIZE, sideEndpoints, wallPiece, type Cell, type Wall } from '../../engine';
import { CELL } from './geometry';

/** Accessible title of a wall group, e.g. `Wall W6 (88 + 44 mm): C2-E, C3-E, C3-S`. */
export function wallTitle(wall: Wall): string {
  const piece = wallPiece(wall.id);
  const name = piece ? `Wall ${piece.id} (${piece.sizeMm})` : 'Wall';
  return `${name}: ${wall.sides.join(', ')}`;
}

/** Centre of a wall name badge, in SVG user units. */
export interface LabelPoint {
  x: number;
  y: number;
}

/** Size of a wall name badge, in SVG user units. */
export const BADGE_WIDTH = 26;
export const BADGE_HEIGHT = 17;

/** Half-size of the box covered by an enemy or goal symbol (goal star outer radius 0.42 cell). */
const SYMBOL_HALF = 17;
/** Half-size of the box covered by a start label ("P1" … "P4", 12 px bold). */
const START_HALF_X = 10;
const START_HALF_Y = 8;

/** Sideways shifts of a candidate, perpendicular to its side (SVG units, < 1 cell). */
const OFFSETS = [0, -10, 10, -20, 20, -30, 30];
/** Positions along a side, as a fraction of its length (slightly past its ends too). */
const FRACTIONS = [0.5, 0.25, 0.75, 0, 1, -0.25, 1.25];

/** Score weights: hiding an enemy or the goal is worst, then leaving the board, then the rest. */
const W_SYMBOL = 1_000_000;
const W_OUTSIDE = 10_000;
const W_SOFT = 100;

const SIZE = BOARD_SIZE * CELL;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function badgeBox({ x, y }: LabelPoint): Box {
  return {
    x0: x - BADGE_WIDTH / 2,
    y0: y - BADGE_HEIGHT / 2,
    x1: x + BADGE_WIDTH / 2,
    y1: y + BADGE_HEIGHT / 2,
  };
}

function cellBox(c: Cell, halfX: number, halfY: number): Box {
  const cx = c.x * CELL + CELL / 2;
  const cy = c.y * CELL + CELL / 2;
  return { x0: cx - halfX, y0: cy - halfY, x1: cx + halfX, y1: cy + halfY };
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Area of the badge lying outside the board square. */
function outside(box: Box): number {
  const area = (box.x1 - box.x0) * (box.y1 - box.y0);
  return area - overlap(box, { x0: 0, y0: 0, x1: SIZE, y1: SIZE });
}

interface Candidate {
  point: LabelPoint;
  box: Box;
  /** Score that does not depend on the other badges. */
  base: number;
}

/**
 * Candidate centres of a wall's badge: points along each side, on the wall or shifted sideways
 * (perpendicular to the side) by up to 3/4 of a cell, so the badge centre stays within one cell
 * of its wall.
 */
function candidates(wall: Wall, symbols: readonly Box[], startLabels: readonly Box[]): Candidate[] {
  const middle = wall.sides.length / 2;
  const result: Candidate[] = [];
  wall.sides.forEach((side, index) => {
    const [a, b] = sideEndpoints(side);
    const vertical = a.px === b.px;
    for (const f of FRACTIONS) {
      for (const offset of OFFSETS) {
        const point = {
          x: (a.px + (b.px - a.px) * f) * CELL + (vertical ? offset : 0),
          y: (a.py + (b.py - a.py) * f) * CELL + (vertical ? 0 : offset),
        };
        const box = badgeBox(point);
        const hidden = symbols.reduce((sum, s) => sum + overlap(box, s), 0);
        const starts = startLabels.reduce((sum, s) => sum + overlap(box, s), 0);
        const base =
          W_SYMBOL * hidden +
          W_OUTSIDE * outside(box) +
          W_SOFT * starts +
          Math.abs(offset) +
          Math.abs(index + f - middle) * 4;
        result.push({ point, box, base });
      }
    }
  });
  return result;
}

/**
 * Picks where to draw each wall's name badge: on its wall or shifted sideways by at most 3/4 of a
 * cell. In order of priority it avoids hiding an enemy or the goal, leaving the board, and hiding
 * a start label or another badge; then it prefers a badge on the wall, near its middle. Walls with
 * the fewest free spots are placed first. Returns one point per wall, in the order of `walls`.
 */
export function placeWallLabels(
  walls: readonly Wall[],
  symbolCells: readonly Cell[],
  startCells: readonly Cell[] = [],
): LabelPoint[] {
  const symbols = symbolCells.map((c) => cellBox(c, SYMBOL_HALF, SYMBOL_HALF));
  const startLabels = startCells.map((c) => cellBox(c, START_HALF_X, START_HALF_Y));
  const options = walls.map((wall) => candidates(wall, symbols, startLabels));
  const free = options.map((list) => list.filter((c) => c.base < W_SOFT).length);
  const order = walls.map((_, i) => i).sort((i, j) => free[i] - free[j] || i - j);

  const placed: Box[] = [];
  const result: LabelPoint[] = walls.map(() => ({ x: 0, y: 0 }));
  for (const i of order) {
    let best = options[i][0];
    let bestScore = Infinity;
    for (const c of options[i]) {
      const score = c.base + W_SOFT * placed.reduce((sum, p) => sum + overlap(c.box, p), 0);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    placed.push(best.box);
    result[i] = best.point;
  }
  return result;
}
