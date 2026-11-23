import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';
import { isBorderSide } from './side';
import { WALL_COUNT } from './types';
import { isValidWallShape, placeWalls, wallShape, wallsOverlap } from './walls';

describe('placeWalls', () => {
  it('places valid, non-overlapping walls deterministically', () => {
    for (let seed = 0; seed < 500; seed++) {
      const walls = placeWalls(mulberry32(seed));
      expect(walls).toHaveLength(WALL_COUNT);
      expect(walls.every(isValidWallShape)).toBe(true);
      expect(walls.some((w) => w.sides.some((s) => isBorderSide(s)))).toBe(false);
      expect(wallsOverlap(walls)).toBe(false);
      expect(placeWalls(mulberry32(seed))).toEqual(walls);
    }
  });

  it('classifies wall shapes', () => {
    expect(wallShape({ sides: ['B2-E', 'B3-E', 'B4-E'] })).toBe('straight');
    expect(wallShape({ sides: ['B2-E', 'B3-E', 'C3-S'] })).toBe('L');
    expect(wallShape({ sides: ['B2-E', 'B3-E', 'C3-S', 'C4-E'] })).toBe('invalid');
    expect(wallShape({ sides: ['B2-E', 'B4-E'] })).toBe('invalid');
    expect(wallShape({ sides: ['A2-W', 'A3-W'] })).toBe('invalid');
    expect(wallShape({ sides: ['B2-E'] })).toBe('invalid');
    expect(wallsOverlap([{ sides: ['B2-E', 'B3-E'] }, { sides: ['C3-W', 'C4-W'] }])).toBe(true);
  });
});
