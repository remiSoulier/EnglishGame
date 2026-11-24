import { sideEndpoints, type Wall } from '../../engine';
import { CELL } from './geometry';

/** A point in SVG user units. */
export interface Point {
  x: number;
  y: number;
}

/**
 * The two free ends of a wall piece, in SVG user units.
 *
 * A lattice point used by exactly one of the wall's sides is an end; points shared by two
 * sides (straight joins and L corners) are not. Order follows the wall's sides.
 */
export function wallEnds(wall: Pick<Wall, 'sides'>): Point[] {
  const count = new Map<string, number>();
  const order: Point[] = [];
  for (const side of wall.sides) {
    for (const p of sideEndpoints(side)) {
      const key = `${p.px},${p.py}`;
      const n = count.get(key) ?? 0;
      if (n === 0) order.push({ x: p.px * CELL, y: p.py * CELL });
      count.set(key, n + 1);
    }
  }
  return order.filter((p) => count.get(`${p.x / CELL},${p.y / CELL}`) === 1);
}
