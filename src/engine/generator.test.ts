import { describe, expect, it } from 'vitest';
import { isFullyConnected } from './connectivity';
import { cellName, isStartCell, sameCell } from './cell';
import { generateBoard, placeEnemies, placeGoal, startCellsFor } from './generator';
import { mulberry32 } from './rng';
import { ENEMY_COUNT, type Difficulty } from './types';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

describe('placeGoal / placeEnemies', () => {
  it('never puts the goal on a start cell', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 2000; i++) expect(isStartCell(placeGoal(rng))).toBe(false);
  });

  it('places distinct enemies off the goal and start cells', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 500; i++) {
      const goal = placeGoal(rng);
      const enemies = placeEnemies(rng, 6, goal);
      expect(new Set(enemies.map(cellName)).size).toBe(6);
      for (const e of enemies) {
        expect(isStartCell(e) || sameCell(e, goal)).toBe(false);
      }
    }
  });

  it('rejects invalid counts and goals', () => {
    const rng = mulberry32(3);
    expect(() => placeEnemies(rng, -1, { x: 4, y: 4 })).toThrow();
    expect(() => placeEnemies(rng, 77, { x: 4, y: 4 })).toThrow();
    expect(() => placeEnemies(rng, 2, { x: 0, y: 0 })).toThrow();
  });
});

describe('generateBoard', () => {
  it('is deterministic and respects the constraints', () => {
    for (const d of DIFFICULTIES) {
      const a = generateBoard('k7f2 9qx', 1, d);
      expect(a).toEqual(generateBoard('K7F2-9QX', 1, d));
      expect(a.code).toBe('K7F2-9QX');
      expect(a.enemies).toHaveLength(ENEMY_COUNT[d]);
      expect(a.walls).toHaveLength(8);
      expect(isFullyConnected(a.walls)).toBe(true);
      expect(isStartCell(a.goal)).toBe(false);
    }
  });

  it('keeps the goal fixed across turns', () => {
    const t1 = generateBoard('K7F2-9QX', 1, 'medium');
    expect(generateBoard('K7F2-9QX', 1, 'medium', t1.goal)).toEqual(t1);
    for (let turn = 2; turn <= 5; turn++) {
      const b = generateBoard('K7F2-9QX', turn, 'medium', t1.goal);
      expect(b.goal).toEqual(t1.goal);
      expect(generateBoard('K7F2-9QX', turn, 'medium')).toEqual(b);
      expect(b.enemies.some((e) => sameCell(e, t1.goal))).toBe(false);
    }
  });

  it('throws on invalid input', () => {
    expect(() => generateBoard('nope', 1, 'easy')).toThrow();
    expect(() => generateBoard('K7F2-9QX', 0, 'easy')).toThrow();
    expect(() => generateBoard('K7F2-9QX', 1.5, 'easy')).toThrow();
    expect(() => generateBoard('K7F2-9QX', 2, 'easy', { x: 8, y: 8 })).toThrow();
    expect(() => generateBoard('K7F2-9QX', 2, 'easy', { x: 9, y: 0 })).toThrow();
  });

  it('startCellsFor returns the first N start cells', () => {
    expect(startCellsFor(2).map(cellName)).toEqual(['A1', 'I9']);
    expect(startCellsFor(4).map(cellName)).toEqual(['A1', 'I9', 'I1', 'A9']);
  });
});
