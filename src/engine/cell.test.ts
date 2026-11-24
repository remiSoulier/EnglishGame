import { describe, expect, it } from 'vitest';
import {
  allCells,
  cellKey,
  cellName,
  DIRS,
  isInside,
  isStartCell,
  neighbors,
  OPPOSITE,
  parseCell,
  sameCell,
  step,
} from './cell';
import {
  BOARD_SIZE,
  COLUMNS,
  ENEMY_COUNT,
  START_CELLS,
  WALL_COUNT,
  type Board,
  type Cell,
  type Difficulty,
  type Side,
  type Wall,
} from './types';

const c = (name: string): Cell => parseCell(name);
const names = (cells: Cell[]): string[] => cells.map(cellName);

describe('constants and types', () => {
  it('exposes the board constants', () => {
    expect(BOARD_SIZE).toBe(9);
    expect(COLUMNS).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
    expect(ENEMY_COUNT).toEqual({ easy: 2, medium: 4, hard: 6 });
    expect(WALL_COUNT).toBe(8);
  });

  it('lists start cells in player order A1, I9, I1, A9', () => {
    expect(names([...START_CELLS])).toEqual(['A1', 'I9', 'I1', 'A9']);
  });

  it('freezes START_CELLS', () => {
    expect(Object.isFrozen(START_CELLS)).toBe(true);
    expect(START_CELLS.every((cell) => Object.isFrozen(cell))).toBe(true);
  });

  it('allows building values of every model type', () => {
    const difficulty: Difficulty = 'medium';
    const side: Side = { cell: { x: 2, y: 2 }, dir: 'E' };
    const wall: Wall = { id: 'W1', sides: ['C3-E', 'C4-E'] };
    const board: Board = {
      code: 'ABC',
      turn: 1,
      difficulty,
      walls: [wall],
      enemies: [{ x: 4, y: 4 }],
      goal: { x: 3, y: 3 },
    };
    expect(side.dir).toBe('E');
    expect(board.walls[0].sides).toHaveLength(2);
    expect(ENEMY_COUNT[board.difficulty]).toBe(4);
  });
});

describe('cellName / parseCell', () => {
  it('maps x to columns and y to rows (row 1 at the top)', () => {
    expect(cellName({ x: 0, y: 0 })).toBe('A1');
    expect(cellName({ x: 8, y: 0 })).toBe('I1');
    expect(cellName({ x: 0, y: 8 })).toBe('A9');
    expect(cellName({ x: 8, y: 8 })).toBe('I9');
    expect(cellName({ x: 2, y: 2 })).toBe('C3');
    expect(parseCell('D7')).toEqual({ x: 3, y: 6 });
  });

  it('round-trips all 81 cells', () => {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const name = cellName({ x, y });
        expect(parseCell(name)).toEqual({ x, y });
        expect(cellName(parseCell(name))).toBe(name);
      }
    }
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(parseCell('c3')).toEqual({ x: 2, y: 2 });
    expect(parseCell('  i9 ')).toEqual({ x: 8, y: 8 });
  });

  it.each(['', 'J1', 'A0', 'A10', '3C', 'AA', 'A', '1', 'C 3', 'C3-E', '@1'])(
    'rejects invalid name %j',
    (name) => {
      expect(() => parseCell(name)).toThrow();
    },
  );

  it.each([
    { x: -1, y: 0 },
    { x: 9, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 9 },
    { x: 1.5, y: 0 },
  ])('cellName throws for off-board cell %j', (cell) => {
    expect(() => cellName(cell)).toThrow();
  });

  it('cellKey is cellName', () => {
    expect(cellKey({ x: 4, y: 4 })).toBe('E5');
  });
});

describe('isInside', () => {
  it('accepts every in-bounds corner', () => {
    for (const cell of [c('A1'), c('I1'), c('A9'), c('I9')]) {
      expect(isInside(cell)).toBe(true);
    }
  });

  it.each([
    { x: -1, y: 4 },
    { x: 9, y: 4 },
    { x: 4, y: -1 },
    { x: 4, y: 9 },
    { x: 0.5, y: 0 },
    { x: 0, y: Number.NaN },
    { x: Number.POSITIVE_INFINITY, y: 0 },
  ])('rejects %j', (cell) => {
    expect(isInside(cell)).toBe(false);
  });
});

describe('allCells', () => {
  it('returns 81 unique in-bounds cells in row-major order', () => {
    const cells = allCells();
    expect(cells).toHaveLength(81);
    expect(new Set(names(cells)).size).toBe(81);
    expect(cells.every(isInside)).toBe(true);
    expect(cellName(cells[0])).toBe('A1');
    expect(cellName(cells[1])).toBe('B1');
    expect(cellName(cells[9])).toBe('A2');
    expect(cellName(cells[80])).toBe('I9');
  });

  it('returns a fresh array each call', () => {
    const a = allCells();
    a[0].x = 5;
    expect(allCells()[0]).toEqual({ x: 0, y: 0 });
  });
});

describe('isStartCell', () => {
  it('is true exactly for the four corners', () => {
    const starts = allCells().filter(isStartCell);
    expect(names(starts).sort()).toEqual(['A1', 'A9', 'I1', 'I9']);
  });
});

describe('step / OPPOSITE / sameCell', () => {
  it('moves one cell in each direction (N toward row 1)', () => {
    expect(cellName(step(c('C3'), 'N'))).toBe('C2');
    expect(cellName(step(c('C3'), 'S'))).toBe('C4');
    expect(cellName(step(c('C3'), 'E'))).toBe('D3');
    expect(cellName(step(c('C3'), 'W'))).toBe('B3');
  });

  it('may leave the board without throwing', () => {
    expect(step(c('A1'), 'N')).toEqual({ x: 0, y: -1 });
    expect(step(c('A1'), 'W')).toEqual({ x: -1, y: 0 });
    expect(step(c('I9'), 'S')).toEqual({ x: 8, y: 9 });
    expect(step(c('I9'), 'E')).toEqual({ x: 9, y: 8 });
  });

  it('does not mutate its input', () => {
    const cell = c('E5');
    step(cell, 'N');
    expect(cell).toEqual({ x: 4, y: 4 });
  });

  it('step then opposite step returns to start', () => {
    for (const dir of DIRS) {
      expect(step(step(c('E5'), dir), OPPOSITE[dir])).toEqual(c('E5'));
    }
  });

  it('sameCell compares coordinates', () => {
    expect(sameCell({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(sameCell({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });
});

describe('neighbors', () => {
  it('returns 2 for each corner', () => {
    expect(names(neighbors(c('A1')))).toEqual(['B1', 'A2']);
    expect(names(neighbors(c('I1')))).toEqual(['I2', 'H1']);
    expect(names(neighbors(c('A9')))).toEqual(['A8', 'B9']);
    expect(names(neighbors(c('I9')))).toEqual(['I8', 'H9']);
  });

  it('returns 3 for a cell on each border, in N,E,S,W order', () => {
    expect(names(neighbors(c('E1')))).toEqual(['F1', 'E2', 'D1']); // top
    expect(names(neighbors(c('E9')))).toEqual(['E8', 'F9', 'D9']); // bottom
    expect(names(neighbors(c('A5')))).toEqual(['A4', 'B5', 'A6']); // left
    expect(names(neighbors(c('I5')))).toEqual(['I4', 'I6', 'H5']); // right
  });

  it('returns 4 for an inner cell in N,E,S,W order', () => {
    expect(names(neighbors(c('C3')))).toEqual(['C2', 'D3', 'C4', 'B3']);
  });

  it('has the expected count for every cell and is symmetric', () => {
    for (const cell of allCells()) {
      const onX = cell.x === 0 || cell.x === 8;
      const onY = cell.y === 0 || cell.y === 8;
      const expected = onX && onY ? 2 : onX || onY ? 3 : 4;
      const ns = neighbors(cell);
      expect(ns).toHaveLength(expected);
      for (const n of ns) {
        expect(isInside(n)).toBe(true);
        expect(Math.abs(n.x - cell.x) + Math.abs(n.y - cell.y)).toBe(1);
        expect(neighbors(n).some((m) => sameCell(m, cell))).toBe(true);
      }
    }
  });
});
