import { describe, expect, it } from 'vitest';
import {
  activeIndex,
  DECK_STEP,
  OVERLAP,
  PEEK,
  PEEK_DEPTH,
  placeCards,
  TOP_MARGIN,
} from './deckLayout';

describe('activeIndex (D29)', () => {
  it('moves one card per DECK_STEP of scroll, rounding to the nearest card', () => {
    expect(activeIndex(-300, 10)).toBe(0);
    expect(activeIndex(0, 10)).toBe(0);
    expect(activeIndex(DECK_STEP * 0.49, 10)).toBe(0);
    expect(activeIndex(DECK_STEP * 0.5, 10)).toBe(1);
    expect(activeIndex(DECK_STEP * 3, 10)).toBe(3);
    expect(activeIndex(DECK_STEP * 42, 10)).toBe(9);
  });

  it('is safe with no cards or a bad scroll value', () => {
    expect(activeIndex(500, 0)).toBe(0);
    expect(activeIndex(Number.NaN, 10)).toBe(0);
  });
});

describe('placeCards (D29)', () => {
  const heights = [300, 90, 90, 90, 90, 90];

  it('first card at the front at the top, the next ones stacked under it', () => {
    const cards = placeCards(heights, 0);
    expect(cards[0]).toEqual({ top: TOP_MARGIN, scale: 1, hidden: false, z: 1 });
    expect(cards[1].top).toBe(TOP_MARGIN + 300 - OVERLAP);
    expect(cards[2].top).toBe(cards[1].top + 90 - OVERLAP);
    expect(cards.map((c) => c.hidden)).toEqual(heights.map(() => false));
  });

  it('cards already seen are tucked behind the front one, smaller, peeking out above it', () => {
    const cards = placeCards([90, 90, 90, 300, 90, 90], 3);
    const front = TOP_MARGIN + PEEK * PEEK_DEPTH;
    expect(cards[3].top).toBe(front);
    expect(cards.slice(0, 3).map((c) => c.top)).toEqual([front - 30, front - 20, front - 10]);
    expect(cards[0].scale).toBeLessThan(cards[1].scale);
    expect(cards[2].scale).toBeLessThan(1);
    // Behind the front card, which is under the next card (its upward shadow, D25).
    expect(cards[2].z).toBeLessThan(cards[3].z);
    expect(cards[3].z).toBeLessThan(cards[4].z);
    expect(cards[4].top).toBe(front + 300 - OVERLAP);
  });

  it('hides the cards too deep behind to peek out', () => {
    const cards = placeCards(Array(8).fill(90), 6);
    expect(cards.slice(0, 6).map((c) => c.hidden)).toEqual([true, true, true, false, false, false]);
    expect(cards[2].top).toBe(cards[3].top);
  });
});
