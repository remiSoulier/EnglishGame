import { describe, expect, it } from 'vitest';
import { SWIPE_MIN, swipeStep } from './swipe';

describe('swipeStep (D35)', () => {
  it('swipe left goes to the next step, swipe right to the previous one', () => {
    expect(swipeStep(-80, 5)).toBe(1);
    expect(swipeStep(80, -5)).toBe(-1);
    expect(swipeStep(-SWIPE_MIN, 0)).toBe(1);
  });

  it('ignores taps, short moves, vertical scrolls and slanted gestures', () => {
    expect(swipeStep(0, 0)).toBe(0);
    expect(swipeStep(-(SWIPE_MIN - 1), 0)).toBe(0);
    expect(swipeStep(-20, 300)).toBe(0);
    expect(swipeStep(-90, 70)).toBe(0);
  });
});
