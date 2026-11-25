import { describe, expect, it } from 'vitest';
import { newCode } from './boardCode';
import { cellName } from './cell';
import {
  GOAL_CANDIDATES,
  GOAL_MAX_SPREAD,
  GOAL_MIN_STEPS,
  generateBoard,
  goalStepsToStarts,
  isFairGoal,
} from './generator';
import { mulberry32 } from './rng';

// Decision D17: the dragon (goal) starts at least 6 grid steps from every start corner, and no
// player is more than 4 steps closer to it than another (all four corners count, any player count).
describe('fair goal placement (D17)', () => {
  it('allows exactly the 13 central cells', () => {
    expect(GOAL_MIN_STEPS).toBe(6);
    expect(GOAL_MAX_SPREAD).toBe(4);
    expect(GOAL_CANDIDATES.map(cellName)).toEqual([
      'E3',
      'D4',
      'E4',
      'F4',
      'C5',
      'D5',
      'E5',
      'F5',
      'G5',
      'D6',
      'E6',
      'F6',
      'E7',
    ]);
  });

  it('computes steps to the four starts (A1, I9, I1, A9)', () => {
    expect(goalStepsToStarts({ x: 4, y: 4 })).toEqual([8, 8, 8, 8]); // E5
    expect(goalStepsToStarts({ x: 1, y: 0 })).toEqual([1, 15, 7, 9]); // B1
  });

  it('rejects cells too close to a start or too unequal between starts', () => {
    expect(isFairGoal({ x: 1, y: 0 })).toBe(false); // B1: 1 step from A1
    expect(isFairGoal({ x: 3, y: 2 })).toBe(false); // D3: 5 steps from A1
    expect(isFairGoal({ x: 1, y: 4 })).toBe(false); // B5: 5 steps from A1 and A9
    expect(isFairGoal({ x: 4, y: 2 })).toBe(true); // E3: 6, 10, 6, 10
  });

  it('every generated board starts with a fair goal, kept on later turns', () => {
    const unfair: string[] = [];
    for (let i = 0; i < 600; i++) {
      const code = newCode(mulberry32(90_000 + i));
      const d = (['easy', 'medium', 'hard'] as const)[i % 3];
      const turn1 = generateBoard(code, 1, d);
      if (!isFairGoal(turn1.goal)) unfair.push(`${code}: ${cellName(turn1.goal)}`);
      expect(generateBoard(code, 3, d).goal).toEqual(turn1.goal);
    }
    expect(unfair).toEqual([]);
  }, 30_000);
});
