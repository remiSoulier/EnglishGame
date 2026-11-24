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

/** Half-size of the box treated as covered by a cell symbol (enemy, goal, start label). */
const SYMBOL_HALF = 16;

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

/** Candidate centres along a wall (quarter points of each side), with their path position. */
function candidates(wall: Wall): { point: LabelPoint; t: number }[] {
  const result: { point: LabelPoint; t: number }[] = [];
  wall.sides.forEach((side, index) => {
    const [a, b] = sideEndpoints(side);
    for (const f of [0.25, 0.5, 0.75]) {
      result.push({
        point: { x: (a.px + (b.px - a.px) * f) * CELL, y: (a.py + (b.py - a.py) * f) * CELL },
        t: index + f,
      });
    }
  });
  return result;
}

/**
 * Picks where to draw each wall's name badge, on the wall itself. Minimises the area the badge
 * hides of the cell symbols (`occupied`: enemies, goal, starts), of the badges already placed and
 * outside the board; ties go to the point closest to the middle of the wall. Returns one point
 * per wall, in the order of `walls`.
 */
export function placeWallLabels(walls: readonly Wall[], occupied: readonly Cell[]): LabelPoint[] {
  const symbols: Box[] = occupied.map((c) => {
    const cx = c.x * CELL + CELL / 2;
    const cy = c.y * CELL + CELL / 2;
    return {
      x0: cx - SYMBOL_HALF,
      y0: cy - SYMBOL_HALF,
      x1: cx + SYMBOL_HALF,
      y1: cy + SYMBOL_HALF,
    };
  });
  const placed: Box[] = [];

  return walls.map((wall) => {
    const middle = wall.sides.length / 2;
    let best: LabelPoint = { x: 0, y: 0 };
    let bestScore = Infinity;

    for (const { point, t } of candidates(wall)) {
      const box = badgeBox(point);
      const score =
        symbols.reduce((sum, s) => sum + overlap(box, s), 0) +
        placed.reduce((sum, p) => sum + 2 * overlap(box, p), 0) +
        outside(box) +
        Math.abs(t - middle);
      if (score < bestScore) {
        bestScore = score;
        best = point;
      }
    }

    placed.push(badgeBox(best));
    return best;
  });
}
