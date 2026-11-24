import { describe, expect, it } from 'vitest';
import { isFullyConnected, placeConnectedWalls, reachableCells } from './connectivity';
import { mulberry32 } from './rng';
import { placeWalls } from './walls';

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

  it('redraws disconnected layouts deterministically', () => {
    let disconnected = 0;
    while (isFullyConnected(placeWalls(mulberry32(disconnected)))) disconnected++;
    expect(disconnected).toBeLessThan(1000);
    expect(isFullyConnected(placeConnectedWalls(mulberry32(disconnected)))).toBe(true);
    for (let seed = 0; seed < 200; seed++) {
      const walls = placeConnectedWalls(mulberry32(seed));
      expect(isFullyConnected(walls)).toBe(true);
      expect(placeConnectedWalls(mulberry32(seed))).toEqual(walls);
    }
  });
});
