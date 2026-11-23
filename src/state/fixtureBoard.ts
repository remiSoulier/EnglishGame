import type { Board } from '../engine';

/** Hand-made board used to preview the UI until the board generator exists. */
export const FIXTURE_BOARD: Board = {
  code: 'DEMO',
  turn: 1,
  difficulty: 'medium',
  walls: [
    { sides: ['C3-E', 'C4-E'] },
    { sides: ['E2-S', 'F2-S', 'G2-S'] },
    { sides: ['B6-E', 'B7-E', 'B8-E'] },
    { sides: ['F5-S', 'G5-S'] },
    { sides: ['H3-E', 'H4-E', 'H5-E', 'H6-E'] },
    { sides: ['D7-S', 'E7-S'] },
    { sides: ['A4-S', 'B4-S'] },
    { sides: ['F8-E', 'F9-E'] },
  ],
  enemies: [
    { x: 2, y: 2 },
    { x: 6, y: 6 },
    { x: 7, y: 1 },
    { x: 1, y: 4 },
  ],
  goal: { x: 4, y: 4 },
};
