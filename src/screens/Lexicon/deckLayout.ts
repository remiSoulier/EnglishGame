/**
 * Layout of the scroll-driven Lexicon deck (decision D32): scrolling the screen moves the cards
 * one by one to the front, where the card shows its detailed view. Pure functions, no DOM.
 */

/** Scroll distance (px) that moves the deck by one card. */
export const DECK_STEP = 200;
/** How far each card behind the front one peeks out above it (px), at most `PEEK_DEPTH` cards. */
export const PEEK = 10;
export const PEEK_DEPTH = 3;
/** How much a card below overlaps the bottom of the card above it (px), as in the stack (D25). */
export const OVERLAP = 18;
/** Room above the peeking cards, for their shadow (px). */
export const TOP_MARGIN = 8;

/** Index of the card at the front for a scroll position inside the deck track. */
export function activeIndex(scrolled: number, count: number, step = DECK_STEP): number {
  if (count <= 0) return 0;
  const index = Math.round(scrolled / step);
  return Math.min(count - 1, Math.max(0, Number.isFinite(index) ? index : 0));
}

/** Where to draw one card of the deck. */
export interface CardPlacement {
  /** Top of the card in the deck (px). */
  top: number;
  /** Scale of a card behind the front one (1 for the others). */
  scale: number;
  /** Hidden behind the front one (too deep to peek out). */
  hidden: boolean;
  /** Stacking order: behind cards < front card < cards below (they overlap upward, D25). */
  z: number;
}

/**
 * Places every card: the front card under the peeking cards behind it, the cards already seen
 * tucked behind it (smaller, peeking out above), the next cards in a stack under it.
 * `heights[i]` is the drawn height of card `i` (0 when unknown).
 */
export function placeCards(heights: readonly number[], active: number): CardPlacement[] {
  // The front card goes down as cards pile up behind it (no empty room above the first card).
  const front = TOP_MARGIN + PEEK * Math.min(active, PEEK_DEPTH);
  let below = front + (heights[active] ?? 0) - OVERLAP;
  return heights.map((height, i) => {
    if (i === active) return { top: front, scale: 1, hidden: false, z: i + 1 };
    if (i < active) {
      const depth = Math.min(active - i, PEEK_DEPTH + 1);
      return {
        top: front - Math.min(depth, PEEK_DEPTH) * PEEK,
        scale: 1 - Math.min(depth, PEEK_DEPTH) * 0.04,
        hidden: depth > PEEK_DEPTH,
        z: i + 1,
      };
    }
    const top = below;
    below += height - OVERLAP;
    return { top, scale: 1, hidden: false, z: i + 1 };
  });
}
