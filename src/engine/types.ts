/**
 * Core types and constants of the board model.
 *
 * Coordinates: x 0–8 ↔ columns A–I (left → right), y 0–8 ↔ rows 1–9 (row 1 at the top).
 */

/** A board cell. `x` 0–8 maps to columns A–I, `y` 0–8 maps to rows 1–9 (y = 0 is the top row). */
export interface Cell {
  x: number;
  y: number;
}

/** Cardinal direction. N = toward row 1 (y - 1), S = y + 1, E = x + 1, W = x - 1. */
export type Dir = 'N' | 'E' | 'S' | 'W';

/** One side of a cell. */
export interface Side {
  cell: Cell;
  dir: Dir;
}

/** Canonical string key of a side, e.g. `C3-E`. Always normalised (see `normalizeSide`). */
export type SideKey = string;

/** A wall: 2–5 contiguous cell sides, as canonical keys ordered along the wall. */
export interface Wall {
  sides: SideKey[];
}

/** Game difficulty. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** A generated board for one turn. */
export interface Board {
  code: string;
  turn: number;
  difficulty: Difficulty;
  walls: Wall[];
  enemies: Cell[];
  goal: Cell;
}

/** Random number generator returning a float in [0, 1). */
export type Rng = () => number;

/** A point of the grid-corner lattice: `px` and `py` range over 0–9. */
export interface GridPoint {
  px: number;
  py: number;
}

/** Number of cells per row / column. */
export const BOARD_SIZE = 9;

/** Column letters, index = x. */
export const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;

/** Number of enemies per difficulty. */
export const ENEMY_COUNT: Readonly<Record<Difficulty, number>> = {
  easy: 2,
  medium: 4,
  hard: 6,
};

/** Number of walls on a board. */
export const WALL_COUNT = 8;

/** Starting cells in player order: P1 = A1, P2 = I9, P3 = I1, P4 = A9. */
export const START_CELLS: readonly Cell[] = Object.freeze([
  Object.freeze({ x: 0, y: 0 }),
  Object.freeze({ x: 8, y: 8 }),
  Object.freeze({ x: 8, y: 0 }),
  Object.freeze({ x: 0, y: 8 }),
]);
