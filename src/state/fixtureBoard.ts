import type { Board } from '../engine';

/**
 * Hand-made board used to preview the UI and in tests: a valid layout of the eight fixed wall
 * pieces W1 … W8 (decision D12), in id order, with every cell reachable.
 */
export const FIXTURE_BOARD: Board = {
  code: 'DEMO',
  turn: 1,
  difficulty: 'medium',
  walls: [
    { id: 'W1', sides: ['C3-E', 'C4-E'] },
    { id: 'W2', sides: ['A4-S', 'B4-S'] },
    { id: 'W3', sides: ['E2-S', 'F2-S', 'G2-S'] },
    { id: 'W4', sides: ['H3-E', 'H4-E', 'H5-E', 'H6-E'] },
    { id: 'W5', sides: ['F7-S', 'F8-E'] },
    { id: 'W6', sides: ['B6-S', 'C6-S', 'C7-E'] },
    { id: 'W7', sides: ['F4-S', 'G4-S', 'G5-E', 'G6-E'] },
    { id: 'W8', sides: ['D8-E', 'D7-E', 'D6-E', 'E5-S', 'F5-S'] },
  ],
  enemies: [
    { x: 2, y: 2 },
    { x: 6, y: 6 },
    { x: 7, y: 1 },
    { x: 1, y: 4 },
  ],
  goal: { x: 4, y: 4 },
};
