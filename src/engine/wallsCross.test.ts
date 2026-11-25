import { describe, expect, it } from 'vitest';
import { generateBoard } from './generator';
import { mulberry32 } from './rng';
import { newCode } from './boardCode';
import { wallInteriorPoints, wallsCross, wallsOverlap } from './walls';

// Decision D16: walls may touch (end to end, or an end against another's flank) but never cross.
describe('wallsCross', () => {
  it('finds the interior points of a straight wall and of an L (its corner is interior)', () => {
    // C3-E: x=3, y 2..3; C4-E: x=3, y 3..4 → interior point (3,3).
    expect([...wallInteriorPoints({ sides: ['C3-E', 'C4-E'] })]).toEqual(['3,3']);
    // L: B2-S (y=2, x 1..2) then B3-E (x=2, y 2..3) → corner (2,2).
    expect([...wallInteriorPoints({ sides: ['B2-S', 'B3-E'] })]).toEqual(['2,2']);
  });

  it('detects two walls crossing in an X', () => {
    const vertical = { sides: ['C3-E', 'C4-E'] }; // x=3, y 2..4, interior (3,3)
    const horizontal = { sides: ['C3-S', 'D3-S'] }; // y=3, x 2..4, interior (3,3)
    expect(wallsOverlap([vertical, horizontal])).toBe(false);
    expect(wallsCross([vertical, horizontal])).toBe(true);
  });

  it('allows walls touching end to end, in a T, or at a shared end corner', () => {
    const a = { sides: ['C3-E', 'C4-E'] }; // x=3, y 2..4
    expect(wallsCross([a, { sides: ['C5-E', 'C6-E'] }])).toBe(false); // end to end at (3,4)
    expect(wallsCross([a, { sides: ['D3-S', 'E3-S'] }])).toBe(false); // T: end (3,3) on a's flank
    expect(wallsCross([a, { sides: ['A2-S', 'B2-S', 'C2-S'] }])).toBe(false); // ends meet at (3,2)
  });

  it('never produces crossing walls over 3 000 generated boards', () => {
    const crossing: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const code = newCode(mulberry32(50_000 + i));
      for (const d of ['easy', 'medium', 'hard'] as const) {
        const b = generateBoard(code, 1 + (i % 3), d);
        if (wallsCross(b.walls)) crossing.push(`${code}/${b.turn}/${d}`);
      }
    }
    expect(crossing).toEqual([]);
  }, 30_000);
});
