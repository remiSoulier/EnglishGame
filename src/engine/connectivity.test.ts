import { describe, expect, it } from 'vitest';
import { isFullyConnected, reachableCells } from './connectivity';

describe('connectivity', () => {
  it('treats an empty board as fully connected', () => {
    expect(isFullyConnected([])).toBe(true);
    expect(reachableCells({ x: 4, y: 4 }, [])).toHaveLength(81);
  });

  it('detects an enclosed corner', () => {
    const walls = [{ sides: ['A1-E', 'A1-S'] }];
    expect(isFullyConnected(walls)).toBe(false);
    expect(reachableCells({ x: 0, y: 0 }, walls)).toEqual([{ x: 0, y: 0 }]);
    expect(reachableCells({ x: 8, y: 8 }, walls)).toHaveLength(80);
  });
});
