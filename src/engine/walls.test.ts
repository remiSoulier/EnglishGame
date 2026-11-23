import { describe, expect, it } from 'vitest';
import { allCells, DIRS, isInside, neighbors, parseCell, step } from './cell';
import { sideKey } from './side';
import type { Cell, Wall } from './types';
import { isBlocked, wallSideSet } from './walls';

const c = (name: string): Cell => parseCell(name);
const wall = (...sides: string[]): Wall => ({ sides });

describe('wallSideSet', () => {
  it('normalises every side to its canonical key', () => {
    const set = wallSideSet([wall('D3-W', 'C4-N'), wall('A3-O', 'I3-E')]);
    expect([...set].sort()).toEqual(['A3-W', 'C3-E', 'C3-S', 'I3-E']);
  });

  it('is empty for no walls and deduplicates equivalent sides', () => {
    expect(wallSideSet([]).size).toBe(0);
    expect(wallSideSet([wall('C3-E'), wall('D3-W')]).size).toBe(1);
  });
});

describe('isBlocked', () => {
  const walls = [wall('C3-E', 'C3-S')];

  it('is false between adjacent cells with no wall', () => {
    expect(isBlocked(c('C3'), c('C2'), walls)).toBe(false);
    expect(isBlocked(c('C3'), c('B3'), walls)).toBe(false);
    expect(isBlocked(c('E5'), c('E6'), [])).toBe(false);
  });

  it('is true across a wall side, in both directions', () => {
    expect(isBlocked(c('C3'), c('D3'), walls)).toBe(true);
    expect(isBlocked(c('D3'), c('C3'), walls)).toBe(true);
    expect(isBlocked(c('C3'), c('C4'), walls)).toBe(true);
    expect(isBlocked(c('C4'), c('C3'), walls)).toBe(true);
  });

  it('works when the wall is written in the non-canonical notation', () => {
    const alt = [wall('D3-W', 'C4-N')];
    expect(isBlocked(c('C3'), c('D3'), alt)).toBe(true);
    expect(isBlocked(c('D3'), c('C3'), alt)).toBe(true);
    expect(isBlocked(c('C3'), c('C4'), alt)).toBe(true);
    expect(isBlocked(c('C4'), c('C3'), alt)).toBe(true);
    expect(isBlocked(c('D3'), c('E3'), alt)).toBe(false);
  });

  it('accepts lower-case and O-alias wall sides', () => {
    expect(isBlocked(c('C3'), c('D3'), [wall('d3-o')])).toBe(true);
  });

  it('finds walls in any wall of the list', () => {
    const many = [wall('A1-E'), wall('E5-S', 'F5-S'), wall('H8-E')];
    expect(isBlocked(c('F5'), c('F6'), many)).toBe(true);
    expect(isBlocked(c('I8'), c('H8'), many)).toBe(true);
    expect(isBlocked(c('G5'), c('G6'), many)).toBe(false);
  });

  it('is true when b is off-board on each of the four borders', () => {
    expect(isBlocked(c('C1'), { x: 2, y: -1 }, [])).toBe(true);
    expect(isBlocked(c('A3'), { x: -1, y: 2 }, [])).toBe(true);
    expect(isBlocked(c('I3'), { x: 9, y: 2 }, [])).toBe(true);
    expect(isBlocked(c('C9'), { x: 2, y: 9 }, [])).toBe(true);
  });

  it('is true for every off-board move and false for every in-board move without walls', () => {
    for (const cell of allCells()) {
      for (const dir of DIRS) {
        const other = step(cell, dir);
        expect(isBlocked(cell, other, [])).toBe(!isInside(other));
      }
    }
  });

  it('blocks exactly the walled side for every interior side', () => {
    for (const cell of allCells()) {
      for (const n of neighbors(cell)) {
        const dir = DIRS.find((d) => {
          const t = step(cell, d);
          return t.x === n.x && t.y === n.y;
        });
        if (!dir) throw new Error('unreachable');
        const w = [wall(sideKey({ cell, dir }))];
        expect(isBlocked(cell, n, w)).toBe(true);
        expect(isBlocked(n, cell, w)).toBe(true);
        for (const other of neighbors(cell)) {
          if (other.x === n.x && other.y === n.y) continue;
          expect(isBlocked(cell, other, w)).toBe(false);
        }
      }
    }
  });

  it.each([
    ['C3', 'C3'],
    ['C3', 'D4'],
    ['C3', 'E3'],
    ['A1', 'A3'],
  ])('throws when %s and %s are not adjacent', (a, b) => {
    expect(() => isBlocked(c(a), c(b), [])).toThrow();
  });

  it('throws when a is off-board', () => {
    expect(() => isBlocked({ x: -1, y: 0 }, c('A1'), [])).toThrow();
  });
});
