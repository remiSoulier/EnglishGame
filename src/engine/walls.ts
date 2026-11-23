import { isInside } from './cell';
import { parseSide, sideBetween, sideKey } from './side';
import type { Cell, SideKey, Wall } from './types';

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
