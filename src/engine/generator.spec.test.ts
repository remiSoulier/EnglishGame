import { describe, expect, it } from 'vitest';
import { newCode, normalizeCode, rngFor } from './boardCode';
import { allCells, cellName, isStartCell } from './cell';
import { isFullyConnected, placeConnectedWalls } from './connectivity';
import { generateBoard, placeEnemies, placeGoal, startCellsFor } from './generator';
import { mulberry32 } from './rng';
import {
  BOARD_SIZE,
  ENEMY_COUNT,
  START_CELLS,
  WALL_COUNT,
  type Board,
  type Cell,
  type Difficulty,
  type Rng,
  type Wall,
} from './types';
import { isValidWallShape, wallsOverlap } from './walls';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const EXPECTED_ENEMIES: Record<Difficulty, number> = { easy: 2, medium: 4, hard: 6 };
const CORNERS = ['A1', 'I1', 'A9', 'I9'];
const HEAVY = { timeout: 30_000 };

/** Independent start-cell check: the four corners. */
const isCorner = (c: Cell): boolean => (c.x === 0 || c.x === 8) && (c.y === 0 || c.y === 8);
const inBoard = (c: Cell): boolean =>
  Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.x <= 8 && c.y >= 0 && c.y <= 8;
const key = (c: Cell): string => `${c.x},${c.y}`;

/** Independent border check on a side string such as `C3-E` (also N/W/O, any case). */
function isBorderSide(raw: string): boolean {
  const m = /^([A-I])([1-9])-([NESWO])$/.exec(raw.trim().toUpperCase());
  if (!m) throw new Error(`bad side ${raw}`);
  const x = m[1].charCodeAt(0) - 65;
  const y = Number(m[2]) - 1;
  const d = m[3];
  return (
    (d === 'N' && y === 0) ||
    (d === 'S' && y === 8) ||
    ((d === 'W' || d === 'O') && x === 0) ||
    (d === 'E' && x === 8)
  );
}

/** Every constraint of a board, as a list of human-readable problems (empty = valid). */
function boardProblems(board: Board, difficulty: Difficulty): string[] {
  const problems: string[] = [];
  const walls: Wall[] = board.walls;
  if (walls.length !== 8 || walls.length !== WALL_COUNT) problems.push(`${walls.length} walls`);
  for (const wall of walls) {
    if (wall.sides.length < 2 || wall.sides.length > 5)
      problems.push(`length ${wall.sides.length}`);
    if (!isValidWallShape(wall)) problems.push(`invalid shape ${wall.sides.join(' ')}`);
    if (wall.sides.some(isBorderSide)) problems.push(`border side in ${wall.sides.join(' ')}`);
  }
  if (wallsOverlap(walls)) problems.push('walls overlap');
  if (!isFullyConnected(walls)) problems.push('not fully connected');
  if (!inBoard(board.goal)) problems.push(`goal off board ${key(board.goal)}`);
  if (isCorner(board.goal) || isStartCell(board.goal)) problems.push('goal on start cell');
  if (board.enemies.length !== EXPECTED_ENEMIES[difficulty]) {
    problems.push(`${board.enemies.length} enemies for ${difficulty}`);
  }
  const seen = new Set<string>();
  for (const e of board.enemies) {
    if (!inBoard(e)) problems.push(`enemy off board ${key(e)}`);
    if (isCorner(e)) problems.push(`enemy on start ${key(e)}`);
    if (e.x === board.goal.x && e.y === board.goal.y) problems.push('enemy on goal');
    if (seen.has(key(e))) problems.push(`duplicate enemy ${key(e)}`);
    seen.add(key(e));
  }
  if (board.difficulty !== difficulty) problems.push(`difficulty ${board.difficulty}`);
  return problems;
}

/** 1 000 (code, turn, difficulty) combinations, reproducible. */
function combos(): { code: string; turn: number; difficulty: Difficulty }[] {
  const rng = mulberry32(5);
  return Array.from({ length: 1000 }, (_, i) => ({
    code: newCode(rng),
    turn: 1 + (i % 12),
    difficulty: DIFFICULTIES[i % 3],
  }));
}

describe('constants', () => {
  it('enemy counts and start cells match the spec', () => {
    expect(ENEMY_COUNT).toEqual(EXPECTED_ENEMIES);
    expect(START_CELLS.map(cellName).sort()).toEqual([...CORNERS].sort());
    expect(BOARD_SIZE).toBe(9);
  });
});

describe('placeGoal', HEAVY, () => {
  it('is never a start cell and covers exactly the 13 fair cells (D17)', () => {
    const rng = mulberry32(42);
    const hits = new Map<string, number>();
    for (let i = 0; i < 5000; i++) {
      const g = placeGoal(rng);
      if (!inBoard(g) || isCorner(g)) throw new Error(`bad goal ${key(g)} at draw ${i}`);
      hits.set(key(g), (hits.get(key(g)) ?? 0) + 1);
    }
    expect(hits.size).toBe(13);
    // Roughly uniform: expected ~385 per cell.
    expect(Math.min(...hits.values())).toBeGreaterThan(300);
    expect(Math.max(...hits.values())).toBeLessThan(470);
  });

  it('maps rng extremes onto valid cells and consumes one value', () => {
    let calls = 0;
    const counting: Rng = () => {
      calls++;
      return 0;
    };
    expect(cellName(placeGoal(counting))).toBe('E3');
    expect(calls).toBe(1);
    expect(cellName(placeGoal(() => 0.999999999))).toBe('E7');
  });

  it('is deterministic per seed', () => {
    expect(placeGoal(mulberry32(9))).toEqual(placeGoal(mulberry32(9)));
  });
});

describe('placeEnemies', HEAVY, () => {
  it('returns exactly `count` distinct cells, none on goal or start, for many draws', () => {
    const rng = mulberry32(7);
    const problems: string[] = [];
    const covered = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const goal = placeGoal(rng);
      const count = i % 8;
      const enemies = placeEnemies(rng, count, goal);
      const keys = enemies.map(key);
      if (enemies.length !== count) problems.push(`#${i} length ${enemies.length}`);
      if (new Set(keys).size !== keys.length) problems.push(`#${i} duplicates`);
      for (const e of enemies) {
        covered.add(key(e));
        if (!inBoard(e) || isCorner(e) || key(e) === key(goal)) problems.push(`#${i} ${key(e)}`);
      }
    }
    expect(problems).toEqual([]);
    expect(covered.size).toBe(77);
  });

  it('handles the edge counts 0 and 76 (every allowed cell but the goal)', () => {
    const goal = { x: 4, y: 4 };
    expect(placeEnemies(mulberry32(1), 0, goal)).toEqual([]);
    const all = placeEnemies(mulberry32(1), 76, goal);
    const expected = allCells()
      .filter((c) => !isCorner(c) && key(c) !== key(goal))
      .map(key)
      .sort();
    expect(all.map(key).sort()).toEqual(expected);
  });

  it('is deterministic per seed', () => {
    const goal = { x: 2, y: 3 };
    expect(placeEnemies(mulberry32(3), 6, goal)).toEqual(placeEnemies(mulberry32(3), 6, goal));
  });

  it('throws on bad count or bad goal', () => {
    const rng = mulberry32(1);
    const goal = { x: 4, y: 4 };
    for (const count of [-1, 1.5, 77, 100, NaN, Infinity]) {
      expect(() => placeEnemies(rng, count, goal), `count ${count}`).toThrow();
    }
    for (const bad of [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 0, y: 8 },
      { x: 8, y: 8 },
      { x: 9, y: 4 },
      { x: -1, y: 4 },
      { x: 4, y: 9 },
      { x: 1.5, y: 2 },
    ]) {
      expect(() => placeEnemies(rng, 2, bad), `goal ${key(bad)}`).toThrow();
    }
  });
});

describe('generateBoard over 1 000 combinations', HEAVY, () => {
  const all = combos();

  it('every board satisfies all constraints', () => {
    const failures: string[] = [];
    for (const { code, turn, difficulty } of all) {
      const board = generateBoard(code, turn, difficulty);
      const problems = boardProblems(board, difficulty);
      if (problems.length > 0)
        failures.push(`${code} t${turn} ${difficulty}: ${problems.join('; ')}`);
      if (board.code !== code || board.turn !== turn) failures.push(`${code} t${turn}: echo`);
    }
    expect(failures).toEqual([]);
  });

  it('is deterministic (two calls deep-equal) and formatting-insensitive', () => {
    const failures: string[] = [];
    for (const { code, turn, difficulty } of all.slice(0, 300)) {
      const a = generateBoard(code, turn, difficulty);
      const b = generateBoard(code, turn, difficulty);
      const messy = ` ${code.slice(0, 4).toLowerCase()} ${code.slice(4).toLowerCase()} `;
      const c = generateBoard(messy, turn, difficulty);
      if (JSON.stringify(a) !== JSON.stringify(b)) failures.push(`${code} t${turn} not repeatable`);
      if (JSON.stringify(a) !== JSON.stringify(c)) failures.push(`${code} t${turn} format`);
    }
    expect(failures).toEqual([]);
  });

  it('is reasonably fast (average well under 10 ms)', () => {
    const t0 = performance.now();
    for (const { code, turn, difficulty } of all.slice(0, 300)) {
      generateBoard(code, turn, difficulty);
    }
    expect((performance.now() - t0) / 300).toBeLessThan(10);
  });
});

describe('generateBoard — code handling', () => {
  it('k7f2 9qx and K7F2-9QX give the same board with the canonical code', () => {
    for (const turn of [1, 2, 7]) {
      const a = generateBoard('k7f2 9qx', turn, 'medium');
      const b = generateBoard('K7F2-9QX', turn, 'medium');
      expect(a).toEqual(b);
      expect(a.code).toBe('K7F2-9QX');
      expect(a.code).toBe(normalizeCode('k7f2 9qx'));
    }
  });

  it('different codes give different boards in general', () => {
    const rng = mulberry32(77);
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const b = generateBoard(newCode(rng), 1, 'hard');
      seen.add(JSON.stringify([b.walls, b.goal, b.enemies]));
    }
    expect(seen.size).toBe(50);
  });

  it('turn 1 follows the documented draw order from rngFor(code, 1)', () => {
    for (const difficulty of DIFFICULTIES) {
      const rng = rngFor('K7F2-9QX', 1);
      const walls = placeConnectedWalls(rng);
      const goal = placeGoal(rng);
      const enemies = placeEnemies(rng, EXPECTED_ENEMIES[difficulty], goal);
      expect(generateBoard('K7F2-9QX', 1, difficulty)).toEqual({
        code: 'K7F2-9QX',
        turn: 1,
        difficulty,
        walls,
        enemies,
        goal,
      });
    }
  });
});

describe('generateBoard — fixed goal across turns', HEAVY, () => {
  const codes = (() => {
    const rng = mulberry32(31);
    return Array.from({ length: 20 }, () => newCode(rng));
  })();

  it('omitted goal: turns 1–10 keep the turn-1 goal and equal the explicit-goal board', () => {
    const failures: string[] = [];
    for (const code of codes) {
      const difficulty = DIFFICULTIES[code.charCodeAt(0) % 3];
      const goal1 = generateBoard(code, 1, difficulty).goal;
      for (let turn = 1; turn <= 10; turn++) {
        const omitted = generateBoard(code, turn, difficulty);
        const passed = generateBoard(code, turn, difficulty, goal1);
        if (key(omitted.goal) !== key(goal1)) failures.push(`${code} t${turn} goal moved`);
        if (JSON.stringify(omitted) !== JSON.stringify(passed)) {
          failures.push(`${code} t${turn} omitted != passed`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('passed goal: kept exactly on turns 1–10 and constraints still hold', () => {
    const failures: string[] = [];
    const goal = { x: 3, y: 6 };
    for (const code of codes) {
      for (let turn = 1; turn <= 10; turn++) {
        const board = generateBoard(code, turn, 'hard', goal);
        if (key(board.goal) !== key(goal)) failures.push(`${code} t${turn} goal changed`);
        failures.push(...boardProblems(board, 'hard').map((p) => `${code} t${turn} ${p}`));
      }
    }
    expect(failures).toEqual([]);
  });

  it('turn 1: passing a goal still consumes the goal draw (walls unchanged)', () => {
    for (const code of codes) {
      const own = generateBoard(code, 1, 'medium');
      expect(generateBoard(code, 1, 'medium', own.goal)).toEqual(own);
      const other = generateBoard(code, 1, 'medium', { x: 4, y: 4 });
      expect(other.walls).toEqual(own.walls);
    }
  });

  it('does not alias the passed goal object', () => {
    const goal = { x: 2, y: 2 };
    const board = generateBoard('K7F2-9QX', 3, 'easy', goal);
    goal.x = 0;
    goal.y = 0;
    expect(board.goal).toEqual({ x: 2, y: 2 });
  });

  it('walls and enemies are redrawn between turns (in general)', () => {
    let wallChanges = 0;
    let enemyChanges = 0;
    let pairs = 0;
    for (const code of codes) {
      for (let turn = 1; turn < 10; turn++) {
        const a = generateBoard(code, turn, 'hard');
        const b = generateBoard(code, turn + 1, 'hard');
        pairs++;
        if (JSON.stringify(a.walls) !== JSON.stringify(b.walls)) wallChanges++;
        if (JSON.stringify(a.enemies) !== JSON.stringify(b.enemies)) enemyChanges++;
      }
    }
    expect(wallChanges).toBeGreaterThanOrEqual(pairs * 0.95);
    expect(enemyChanges).toBeGreaterThanOrEqual(pairs * 0.9);
  });
});

describe('generateBoard — invalid input', () => {
  it('throws on invalid code, turn, difficulty and goal', () => {
    for (const code of ['', 'abc', 'K7F29Q', 'K7F29QXX', 'K7F2-9Q0', 'K7F29QI', '!!!!!!!']) {
      expect(() => generateBoard(code, 1, 'easy'), `code "${code}"`).toThrow();
    }
    for (const turn of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => generateBoard('K7F2-9QX', turn, 'easy'), `turn ${turn}`).toThrow();
    }
    expect(() => generateBoard('K7F2-9QX', 1, 'extreme' as Difficulty)).toThrow();
    for (const turn of [1, 2]) {
      for (const goal of [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 0, y: 8 },
        { x: 8, y: 8 },
        { x: 9, y: 0 },
        { x: -1, y: 3 },
        { x: 3, y: 9 },
        { x: 2.5, y: 3 },
      ]) {
        expect(() => generateBoard('K7F2-9QX', turn, 'easy', goal), `goal ${key(goal)}`).toThrow();
      }
    }
  });
});

describe('startCellsFor', () => {
  it('returns the first N start cells in player order', () => {
    expect(startCellsFor(2).map(cellName)).toEqual(['A1', 'I9']);
    expect(startCellsFor(3).map(cellName)).toEqual(['A1', 'I9', 'I1']);
    expect(startCellsFor(4).map(cellName)).toEqual(['A1', 'I9', 'I1', 'A9']);
  });

  it('returns fresh mutable copies that do not affect START_CELLS', () => {
    const a = startCellsFor(4);
    const b = startCellsFor(4);
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    expect(a[0]).not.toBe(START_CELLS[0]);
    a[0].x = 5;
    a.push({ x: 4, y: 4 });
    expect(START_CELLS[0]).toEqual({ x: 0, y: 0 });
    expect(startCellsFor(4)).toEqual(b);
  });

  it('throws on other player counts', () => {
    for (const n of [0, 1, 5, 2.5]) {
      expect(() => startCellsFor(n as 2)).toThrow();
    }
  });
});
