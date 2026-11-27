/** Swipe between the How to play steps (decision D35). Pure, no DOM. */

/** Shortest horizontal travel (px) that counts as a swipe. */
export const SWIPE_MIN = 50;
/** A swipe must be clearly sideways: |dx| at least this many times |dy|. */
export const SWIPE_RATIO = 1.5;

/**
 * Step move for a finger that travelled (dx, dy): +1 (swipe left, next step), −1 (swipe right,
 * previous step) or 0 (a tap, a vertical scroll or a slanted gesture).
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return 0;
  return dx < 0 ? 1 : -1;
}
