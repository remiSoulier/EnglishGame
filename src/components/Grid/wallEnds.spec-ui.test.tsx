/// <reference types="node" />
/**
 * Task #25 — wall end marks ("rivets"): every wall piece gets a mark on each of its two free
 * ends, never on a straight join or an L corner, so two pieces touching end to end read as two.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  generateBoard,
  matchesPiece,
  mulberry32,
  newCode,
  sideEndpoints,
  type Board,
  type Difficulty,
  type Wall,
  type WallId,
} from '../../engine';
import { FIXTURE_BOARD } from '../../state/fixtureBoard';
import { Legend } from '../Legend';
import { CELL } from './geometry';
import { Grid } from './Grid';
import { WALL_END_RADIUS } from './shapes';
import { wallEnds, type Point } from './wallEnds';

const COLS = 'ABCDEFGHI';
type Step = 'E' | 'S' | 'W' | 'N';
const DELTA: Readonly<Record<Step, [number, number]>> = {
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
  N: [0, -1],
};
const CLOCKWISE: Readonly<Record<Step, Step>> = { E: 'S', S: 'W', W: 'N', N: 'E' };

/**
 * Walks the corner lattice from (px, py) and returns the canonical side keys crossed, plus every
 * lattice point visited. Written independently from the engine: a horizontal step on line py is
 * the S side of the cell above it, a vertical step on line px is the E side of the cell to its
 * left.
 */
function walk(px: number, py: number, steps: Step[]): { sides: string[]; points: Point[] } {
  const sides: string[] = [];
  const points: Point[] = [{ x: px, y: py }];
  let x = px;
  let y = py;
  for (const s of steps) {
    const [dx, dy] = DELTA[s];
    const nx = x + dx;
    const ny = y + dy;
    if (dy === 0) sides.push(`${COLS[Math.min(x, nx)]}${y}-S`);
    else sides.push(`${COLS[x - 1]}${Math.min(y, ny) + 1}-E`);
    x = nx;
    y = ny;
    points.push({ x, y });
  }
  return { sides, points };
}

const svgPoint = (p: Point): Point => ({ x: p.x * CELL, y: p.y * CELL });
const key = (p: Point): string => `${p.x},${p.y}`;
const sortPts = (pts: Point[]): string[] => pts.map(key).sort();

/** Path ends from `sideEndpoints`: lattice points used by exactly one side, × CELL. */
function endsFromSideEndpoints(sides: readonly string[]): Point[] {
  const count = new Map<string, number>();
  for (const s of sides) {
    for (const p of sideEndpoints(s)) {
      const k = `${p.px * CELL},${p.py * CELL}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  return [...count]
    .filter(([, n]) => n === 1)
    .map(([k]) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
}

/** L corner of a wall in SVG units (the point shared by a horizontal and a vertical side). */
function lCorner(sides: readonly string[]): Point | null {
  const byPoint = new Map<string, Set<string>>();
  for (const s of sides) {
    const [a, b] = sideEndpoints(s);
    const orient = a.px === b.px ? 'v' : 'h';
    for (const p of [a, b]) {
      const k = `${p.px * CELL},${p.py * CELL}`;
      byPoint.set(k, (byPoint.get(k) ?? new Set()).add(orient));
    }
  }
  const corner = [...byPoint].find(([, o]) => o.size === 2);
  if (!corner) return null;
  const [x, y] = corner[0].split(',').map(Number);
  return { x, y };
}

describe('wallEnds — straight walls', () => {
  const cases: [number, Step][] = [
    [2, 'E'],
    [3, 'E'],
    [4, 'E'],
    [2, 'S'],
    [3, 'S'],
    [4, 'S'],
  ];
  it.each(cases)('%i sides heading %s → the two extremities', (n, dir) => {
    const { sides, points } = walk(2, 3, Array<Step>(n).fill(dir));
    const ends = wallEnds({ sides });
    expect(ends).toHaveLength(2);
    expect(sortPts(ends)).toEqual(sortPts([points[0], points[n]].map(svgPoint)));
    // No interior join gets a mark.
    for (const inner of points.slice(1, -1)) {
      expect(sortPts(ends)).not.toContain(key(svgPoint(inner)));
    }
    expect(sortPts(ends)).toEqual(sortPts(endsFromSideEndpoints(sides)));
  });

  it('same ends whichever end the sides are stored from', () => {
    const { sides } = walk(5, 1, ['S', 'S', 'S']);
    expect(sortPts(wallEnds({ sides: [...sides].reverse() }))).toEqual(
      sortPts(wallEnds({ sides })),
    );
  });

  it('matches the hand-computed W1 of the fixture (C3-E, C4-E)', () => {
    expect(sortPts(wallEnds({ sides: ['C3-E', 'C4-E'] }))).toEqual(['120,160', '120,80']);
  });

  it('returns points on the 40-unit lattice in SVG units', () => {
    for (const p of wallEnds({ sides: ['E2-S', 'F2-S', 'G2-S'] })) {
      expect(p.x % CELL).toBe(0);
      expect(p.y % CELL).toBe(0);
    }
    expect(sortPts(wallEnds({ sides: ['E2-S', 'F2-S', 'G2-S'] }))).toEqual(['160,80', '280,80']);
  });
});

describe('wallEnds — L walls, every rotation', () => {
  const L: [WallId, number, number][] = [
    ['W5', 1, 1],
    ['W6', 2, 1],
    ['W7', 2, 2],
    ['W8', 3, 2],
  ];
  const rotations: Step[] = ['E', 'S', 'W', 'N'];
  const cases = L.flatMap(([id, a, b]) => rotations.map((first) => [id, a, b, first] as const));

  it.each(cases)('%s (%i + %i) first arm %s → arm tips, never the corner', (id, a, b, first) => {
    const steps = [...Array<Step>(a).fill(first), ...Array<Step>(b).fill(CLOCKWISE[first])];
    const { sides, points } = walk(4, 4, steps);
    const wall: Wall = { id, sides };
    expect(matchesPiece(wall), `${id} ${sides.join(',')} is a legal piece`).toBe(true);

    const ends = wallEnds(wall);
    expect(ends).toHaveLength(2);
    const tips = [points[0], points[a + b]].map(svgPoint);
    expect(sortPts(ends)).toEqual(sortPts(tips));
    const corner = svgPoint(points[a]);
    expect(lCorner(sides)).toEqual(corner);
    expect(sortPts(ends)).not.toContain(key(corner));
    expect(sortPts(ends)).toEqual(sortPts(endsFromSideEndpoints(sides)));
    // Read from the other end, still the same two tips.
    expect(sortPts(wallEnds({ sides: [...sides].reverse() }))).toEqual(sortPts(tips));
  });
});

function renderSvg(board: Board): SVGSVGElement {
  const { container } = render(<Grid board={board} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('no svg');
  return svg;
}

function rivets(svg: SVGSVGElement): Element[] {
  return Array.from(svg.querySelectorAll('[data-testid="wall-ends"] circle'));
}

const centre = (c: Element): Point => ({
  x: Number(c.getAttribute('cx')),
  y: Number(c.getAttribute('cy')),
});

function checkRivets(board: Board, label: string): void {
  const svg = renderSvg(board);
  const group = svg.querySelector('[data-testid="wall-ends"]');
  expect(group, label).not.toBeNull();
  expect(group, label).toHaveAttribute('aria-hidden', 'true');

  const marks = rivets(svg);
  expect(marks, label).toHaveLength(2 * board.walls.length);
  expect(group!.children, label).toHaveLength(marks.length);
  marks.forEach((m) => expect(Number(m.getAttribute('r')), label).toBe(4.5));

  // Marks are drawn wall by wall, two each, at that wall's own path ends.
  board.walls.forEach((wall, i) => {
    const own = marks.slice(2 * i, 2 * i + 2).map(centre);
    expect(sortPts(own), `${label} ${wall.id}`).toEqual(sortPts(endsFromSideEndpoints(wall.sides)));
    const corner = lCorner(wall.sides);
    if (corner) expect(sortPts(own), `${label} ${wall.id} corner`).not.toContain(key(corner));
  });

  // No mark sits on an L corner or straight join unless another wall ends there.
  const allEnds = new Set(board.walls.flatMap((w) => endsFromSideEndpoints(w.sides)).map(key));
  for (const m of marks) expect(allEnds.has(key(centre(m))), label).toBe(true);
}

const CASES: [string, number, Difficulty][] = [
  ['K7F2-9QX', 1, 'easy'],
  ['ABCD-EFG', 1, 'hard'],
  ['HJKM-NPQ', 3, 'hard'],
  ['2345-678', 1, 'medium'],
  ['ZZ9Y-8XW', 2, 'hard'],
];

describe('Grid — wall end marks', () => {
  it('fixture: 16 marks, two per wall, on its own ends, none on an L corner', () => {
    checkRivets(FIXTURE_BOARD, 'fixture');
    expect(rivets(renderSvg(FIXTURE_BOARD))).toHaveLength(16);
  });

  it('fixture W6 (B6-S, C6-S, C7-E): marks at (40,240) and (120,280), not corner (120,240)', () => {
    const svg = renderSvg(FIXTURE_BOARD);
    const i = FIXTURE_BOARD.walls.findIndex((w) => w.id === 'W6');
    const own = rivets(svg)
      .slice(2 * i, 2 * i + 2)
      .map(centre);
    expect(sortPts(own)).toEqual(['120,280', '40,240']);
  });

  it.each(CASES)('generated %s turn %i %s', (code, turn, difficulty) => {
    const board = generateBoard(code, turn, difficulty);
    expect(board.walls).toHaveLength(8);
    checkRivets(board, `${code}/${turn}/${difficulty}`);
  });

  it('120 generated boards: always 16 marks at wall ends', () => {
    const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    for (let i = 0; i < 40; i++) {
      const code = newCode(mulberry32(1000 + i));
      difficulties.forEach((difficulty, d) => {
        const board = generateBoard(code, 1 + ((i + d) % 3), difficulty);
        checkRivets(board, `${code}/${difficulty}`);
      });
    }
  }, 20_000);

  it('draws marks after the walls and before the badges', () => {
    const { container } = render(<Grid board={FIXTURE_BOARD} wallLabels />);
    const svg = container.querySelector('svg')!;
    const walls = svg.querySelector('[data-testid="walls"]')!;
    const ends = svg.querySelector('[data-testid="wall-ends"]')!;
    const labels = svg.querySelector('[data-testid="wall-labels"]')!;
    expect(walls.compareDocumentPosition(ends) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ends.compareDocumentPosition(labels) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Not nested inside either neighbour.
    expect(walls.contains(ends)).toBe(false);
    expect(labels.contains(ends)).toBe(false);
  });

  it('keeps the accessible name unchanged', () => {
    renderSvg(FIXTURE_BOARD);
    expect(
      screen.getByRole('img', {
        name: 'Board, turn 1. Goal on E5. Enemies on C3, G7, H2, B5. 8 walls.',
      }),
    ).toBeInTheDocument();
  });

  it('draws no marks for a board without walls', () => {
    const svg = renderSvg({ ...FIXTURE_BOARD, walls: [] });
    expect(svg.querySelector('[data-testid="wall-ends"]')).not.toBeNull();
    expect(rivets(svg)).toHaveLength(0);
  });

  it('exports a 4.5-unit radius and styles .wallEnd as a white disc ringed in wall colour', () => {
    expect(WALL_END_RADIUS).toBe(4.5);
    // Read from disk: Vitest blanks CSS imports.
    const css = readFileSync(resolve(process.cwd(), 'src/components/Grid/Grid.module.css'), 'utf8');
    const rule = css.match(/\.wallEnd\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/fill:\s*var\(--color-board-bg\)/);
    expect(rule).toMatch(/stroke:\s*var\(--color-wall\)/);
    expect(rule).toMatch(/stroke-width:\s*2\b/);
  });
});

describe('Grid — touching pieces', () => {
  /** First generated board where two different walls share an end point, with that point. */
  function findTouching(): { board: Board; point: Point; ids: string[] } {
    const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    for (let i = 0; i < 500; i++) {
      const code = newCode(mulberry32(i));
      for (const difficulty of difficulties) {
        const board = generateBoard(code, 1, difficulty);
        const owners = new Map<string, string[]>();
        for (const w of board.walls) {
          for (const p of endsFromSideEndpoints(w.sides)) {
            owners.set(key(p), [...(owners.get(key(p)) ?? []), w.id]);
          }
        }
        const hit = [...owners].find(([, ids]) => new Set(ids).size >= 2);
        if (hit) {
          const [x, y] = hit[0].split(',').map(Number);
          return { board, point: { x, y }, ids: hit[1] };
        }
      }
    }
    throw new Error('no generated board with two walls touching end to end');
  }

  it('draws a mark at the end point shared by two different pieces', () => {
    const { board, point, ids } = findTouching();
    const svg = renderSvg(board);
    const here = rivets(svg).filter((m) => key(centre(m)) === key(point));
    // One mark per piece ending there, so the junction reads as two pieces.
    expect(here.length, `${board.code} ${ids.join('+')} at ${key(point)}`).toBe(ids.length);
  });

  it('hand-made: W1 and W2 meeting end to end in a line get a mark each at the join', () => {
    const board: Board = {
      ...FIXTURE_BOARD,
      walls: [
        { id: 'W1', sides: ['B2-S', 'C2-S'] },
        { id: 'W2', sides: ['D2-S', 'E2-S'] },
      ],
    };
    const svg = renderSvg(board);
    const join = rivets(svg).filter((m) => key(centre(m)) === '120,80');
    expect(join).toHaveLength(2);
    expect(rivets(svg)).toHaveLength(4);
  });
});

describe('Legend — wall icon', () => {
  it('shows a short wall with an end mark at both of its ends', () => {
    const { container } = render(<Legend />);
    const wall = container.querySelectorAll('li > svg')[0];
    const path = wall.querySelector('path');
    expect(path).not.toBeNull();
    const marks = Array.from(wall.querySelectorAll('circle'));
    expect(marks).toHaveLength(2);
    const nums = (path?.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
    const a = { x: nums[0], y: nums[1] };
    const b = { x: nums[nums.length - 2], y: nums[nums.length - 1] };
    expect(sortPts(marks.map(centre))).toEqual(sortPts([a, b]));
    marks.forEach((m) => expect(Number(m.getAttribute('r'))).toBe(WALL_END_RADIUS));
  });
});
