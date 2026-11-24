/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sideEndpoints, type Board } from '../../engine';
import { FIXTURE_BOARD } from '../../state/fixtureBoard';
import { Legend } from '../Legend';
import { describeBoard } from './describeBoard';
import { CELL } from './geometry';
import { Grid } from './Grid';

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const ROWS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** Physical size of each piece (decision D12), written independently from the engine. */
const MM: Readonly<Record<string, string>> = {
  W1: '88 mm',
  W2: '88 mm',
  W3: '132 mm',
  W4: '176 mm',
  W5: '44 + 44 mm',
  W6: '88 + 44 mm',
  W7: '88 + 88 mm',
  W8: '132 + 88 mm',
};

function board(overrides: Partial<Board> = {}): Board {
  return {
    code: 'TEST',
    turn: 3,
    difficulty: 'easy',
    walls: [],
    enemies: [],
    goal: { x: 4, y: 4 },
    ...overrides,
  };
}

function renderGrid(b: Board = FIXTURE_BOARD, playerCount?: 2 | 3 | 4) {
  const { container } = render(<Grid board={b} playerCount={playerCount} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('no svg rendered');
  return svg;
}

/** Expected path `d` for a wall, built independently from the engine geometry. */
function expectedD(sides: string[]): string {
  return sides
    .map((s) => {
      const [a, b] = sideEndpoints(s);
      return `M${a.px * CELL} ${a.py * CELL}L${b.px * CELL} ${b.py * CELL}`;
    })
    .join('');
}

describe('Grid — svg structure', () => {
  it('is a responsive svg with a viewBox and role img', () => {
    const svg = renderGrid();
    expect(svg).toHaveAttribute('role', 'img');
    const vb = svg.getAttribute('viewBox')?.split(' ').map(Number);
    expect(vb).toHaveLength(4);
    // The 9×9 board (360 units) fits inside the viewBox.
    const [minX, minY, w, h] = vb as number[];
    expect(minX).toBeLessThanOrEqual(0);
    expect(minY).toBeLessThanOrEqual(0);
    expect(minX + w).toBeGreaterThanOrEqual(9 * CELL);
    expect(minY + h).toBeGreaterThanOrEqual(9 * CELL);
    // No fixed pixel size that would defeat responsiveness.
    expect(svg).not.toHaveAttribute('width');
    expect(svg).not.toHaveAttribute('height');
  });

  it('uses cell size 40', () => {
    expect(CELL).toBe(40);
  });

  it('has a <title> equal to the aria-label', () => {
    const svg = renderGrid();
    const title = svg.querySelector(':scope > title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe(svg.getAttribute('aria-label'));
  });
});

describe('Grid — coordinate labels', () => {
  it('shows A–I and 1–9 exactly once each', () => {
    const svg = renderGrid();
    const texts = Array.from(svg.querySelectorAll('text')).map((t) => t.textContent);
    for (const label of [...COLS, ...ROWS]) {
      expect(
        texts.filter((t) => t === label),
        `label ${label}`,
      ).toHaveLength(1);
    }
  });

  it('places columns left→right along the top and rows top→bottom along the left', () => {
    const svg = renderGrid();
    const texts = Array.from(svg.querySelectorAll('text'));
    const col = (c: string) => texts.find((t) => t.textContent === c)!;
    const row = (r: string) =>
      texts.find((t) => t.textContent === r && Number(t.getAttribute('x')) < 0)!;
    COLS.forEach((c, i) => {
      expect(Number(col(c).getAttribute('x'))).toBe(i * CELL + CELL / 2);
      expect(Number(col(c).getAttribute('y'))).toBeLessThan(0);
    });
    ROWS.forEach((r, i) => {
      expect(row(r)).toBeDefined();
      expect(Number(row(r).getAttribute('y'))).toBe(i * CELL + CELL / 2);
    });
  });
});

describe('Grid — walls', () => {
  it('draws one group per wall', () => {
    const svg = renderGrid();
    const walls = svg.querySelectorAll('[data-wall]');
    expect(walls).toHaveLength(FIXTURE_BOARD.walls.length);
    walls.forEach((g) => expect(g.querySelectorAll('path')).toHaveLength(1));
  });

  it('draws C3-E,C4-E as a vertical segment at x=120 from y=80 to y=160', () => {
    const svg = renderGrid(board({ walls: [{ id: 'W1', sides: ['C3-E', 'C4-E'] }] }));
    const path = svg.querySelector('[data-wall="C3-E C4-E"] path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('d')).toBe('M120 80L120 120M120 120L120 160');
  });

  it('draws E2-S,F2-S,G2-S as a horizontal segment at y=80 from x=160 to x=280', () => {
    const svg = renderGrid(board({ walls: [{ id: 'W3', sides: ['E2-S', 'F2-S', 'G2-S'] }] }));
    const d = svg.querySelector('[data-wall="E2-S F2-S G2-S"] path')?.getAttribute('d');
    expect(d).toBe('M160 80L200 80M200 80L240 80M240 80L280 80');
  });

  it('matches sideEndpoints × 40 for every fixture wall', () => {
    const svg = renderGrid();
    for (const wall of FIXTURE_BOARD.walls) {
      const g = svg.querySelector(`[data-wall="${wall.sides.join(' ')}"]`);
      expect(g, wall.sides.join(' ')).not.toBeNull();
      expect(g?.querySelector('path')?.getAttribute('d')).toBe(expectedD(wall.sides));
      expect(g?.querySelector('title')?.textContent).toBe(
        `Wall ${wall.id} (${MM[wall.id]}): ${wall.sides.join(', ')}`,
      );
    }
  });

  it('keeps all wall coordinates on the 0–360 lattice', () => {
    const svg = renderGrid();
    svg.querySelectorAll('[data-wall] path').forEach((p) => {
      const nums = (p.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
      for (const n of nums) {
        expect(n % CELL).toBe(0);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(360);
      }
    });
  });

  it('renders no wall groups for a board without walls', () => {
    const svg = renderGrid(board());
    expect(svg.querySelectorAll('[data-wall]')).toHaveLength(0);
  });
});

describe('Grid — enemies and goal', () => {
  it('marks each enemy cell with a diamond and an exclamation mark', () => {
    const svg = renderGrid();
    const enemies = screen.getByTestId('enemies').querySelectorAll(':scope > [data-cell]');
    expect(Array.from(enemies).map((e) => e.getAttribute('data-cell'))).toEqual([
      'C3',
      'G7',
      'H2',
      'B5',
    ]);
    enemies.forEach((e) => {
      // Diamond = polygon with 4 points; "!" = a line plus a dot.
      const poly = e.querySelector('polygon');
      expect(poly?.getAttribute('points')?.trim().split(/\s+/)).toHaveLength(4);
      expect(e.querySelector('line')).not.toBeNull();
      expect(e.querySelector('circle')).not.toBeNull();
      expect(e.querySelector('title')?.textContent).toMatch(/^Enemy: [A-I][1-9]$/);
    });
    expect(svg).toBeInTheDocument();
  });

  it('centres an enemy diamond in its cell', () => {
    const svg = renderGrid(board({ enemies: [{ x: 2, y: 2 }] }));
    const pts = svg
      .querySelector('[data-testid="enemies"] [data-cell="C3"] polygon')!
      .getAttribute('points')!
      .split(' ')
      .map((p) => p.split(',').map(Number));
    const cx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
    const cy = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
    expect(cx).toBeCloseTo(2 * CELL + CELL / 2);
    expect(cy).toBeCloseTo(2 * CELL + CELL / 2);
  });

  it('draws the goal as a 10-point star on its cell', () => {
    const svg = renderGrid(board({ goal: { x: 6, y: 1 } }));
    const goal = screen.getByTestId('goal');
    expect(goal).toHaveAttribute('data-cell', 'G2');
    expect(goal.querySelector('title')?.textContent).toBe('Goal: G2');
    const pts = goal
      .querySelector('polygon')!
      .getAttribute('points')!
      .split(' ')
      .map((p) => p.split(',').map(Number));
    expect(pts).toHaveLength(10);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThan(6 * CELL);
      expect(x).toBeLessThan(7 * CELL);
      expect(y).toBeGreaterThan(1 * CELL);
      expect(y).toBeLessThan(2 * CELL);
    }
    expect(svg.querySelectorAll('[data-testid="goal"]')).toHaveLength(1);
  });

  it('renders no enemy for a board without enemies', () => {
    renderGrid(board());
    expect(screen.getByTestId('enemies').children).toHaveLength(0);
  });
});

describe('Grid — start cells', () => {
  const startCells = () =>
    Array.from(screen.getByTestId('starts').querySelectorAll(':scope > [data-cell]'));

  it.each([
    [2, ['A1', 'I9']],
    [3, ['A1', 'I9', 'I1']],
    [4, ['A1', 'I9', 'I1', 'A9']],
  ] as const)('playerCount %i draws starts %j', (count, cells) => {
    renderGrid(FIXTURE_BOARD, count);
    const starts = startCells();
    expect(starts.map((s) => s.getAttribute('data-cell'))).toEqual(cells);
    starts.forEach((s, i) => {
      expect(s.querySelector('text')?.textContent).toBe(`P${i + 1}`);
      expect(s.querySelector('title')?.textContent).toBe(`Start P${i + 1}: ${cells[i]}`);
      expect(s.querySelector('rect')).not.toBeNull();
    });
  });

  it('defaults to 4 players', () => {
    renderGrid(FIXTURE_BOARD);
    expect(startCells().map((s) => s.getAttribute('data-cell'))).toEqual(['A1', 'I9', 'I1', 'A9']);
  });

  it('draws the start outline inside the corner cell', () => {
    renderGrid(FIXTURE_BOARD, 4);
    const rect = screen
      .getByTestId('starts')
      .querySelector('[data-cell="I9"] rect') as SVGRectElement;
    const x = Number(rect.getAttribute('x'));
    const y = Number(rect.getAttribute('y'));
    const w = Number(rect.getAttribute('width'));
    const h = Number(rect.getAttribute('height'));
    expect(x).toBeGreaterThanOrEqual(8 * CELL);
    expect(y).toBeGreaterThanOrEqual(8 * CELL);
    expect(x + w).toBeLessThanOrEqual(9 * CELL);
    expect(y + h).toBeLessThanOrEqual(9 * CELL);
  });
});

describe('Grid — no pawns', () => {
  it('renders no pawn or player element', () => {
    const svg = renderGrid();
    expect(svg.querySelector('[data-testid*="pawn" i], [data-pawn], [class*="pawn" i]')).toBeNull();
    expect(svg.textContent?.toLowerCase()).not.toContain('pawn');
    // Only the groups we expect at the top level carry data-testid.
    const ids = Array.from(svg.querySelectorAll('[data-testid]')).map((e) =>
      e.getAttribute('data-testid'),
    );
    expect(ids.sort()).toEqual([
      'enemies',
      'goal',
      'grid-lines',
      'starts',
      'wall-ends',
      'wall-labels',
      'walls',
    ]);
  });

  it('only draws circles as enemy "!" marks or wall end marks (2 per wall)', () => {
    const svg = renderGrid();
    const circles = Array.from(svg.querySelectorAll('circle'));
    const inEnemies = circles.filter((c) => c.closest('[data-testid="enemies"]'));
    const inEnds = circles.filter((c) => c.closest('[data-testid="wall-ends"]'));
    expect(inEnemies).toHaveLength(FIXTURE_BOARD.enemies.length);
    expect(inEnds).toHaveLength(2 * FIXTURE_BOARD.walls.length);
    expect(circles).toHaveLength(inEnemies.length + inEnds.length);
  });
});

describe('Grid — accessible name', () => {
  it('summarises the fixture board', () => {
    renderGrid(FIXTURE_BOARD, 2);
    expect(
      screen.getByRole('img', {
        name: 'Board, turn 1. Goal on E5. Enemies on C3, G7, H2, B5. 8 walls.',
      }),
    ).toBeInTheDocument();
  });

  it('labels coordinates as aria-hidden decoration', () => {
    const svg = renderGrid();
    const labels = Array.from(svg.querySelectorAll('text')).filter((t) =>
      COLS.includes(t.textContent ?? ''),
    );
    labels.forEach((t) => expect(t.closest('[aria-hidden="true"]')).not.toBeNull());
  });
});

describe('describeBoard', () => {
  it('describes zero enemies and zero walls', () => {
    expect(describeBoard(board())).toBe('Board, turn 3. Goal on E5. No enemies. 0 walls.');
  });

  it('uses singular for one enemy and one wall', () => {
    expect(
      describeBoard(
        board({
          enemies: [{ x: 0, y: 1 }],
          walls: [{ id: 'W1', sides: ['C3-E', 'C4-E'] }],
          goal: { x: 8, y: 8 },
        }),
      ),
    ).toBe('Board, turn 3. Goal on I9. Enemy on A2. 1 wall.');
  });

  it('uses plural for several enemies and walls, keeping enemy order', () => {
    expect(
      describeBoard(
        board({
          turn: 12,
          goal: { x: 0, y: 0 },
          enemies: [
            { x: 8, y: 0 },
            { x: 3, y: 6 },
          ],
          walls: [
            { id: 'W1', sides: ['C3-E', 'C4-E'] },
            { id: 'W2', sides: ['A4-S', 'B4-S'] },
          ],
        }),
      ),
    ).toBe('Board, turn 12. Goal on A1. Enemies on I1, D7. 2 walls.');
  });

  it('describes the fixture board', () => {
    expect(describeBoard(FIXTURE_BOARD)).toBe(
      'Board, turn 1. Goal on E5. Enemies on C3, G7, H2, B5. 8 walls.',
    );
  });
});

describe('Legend', () => {
  it('lists Wall, Enemy, Goal, Start in a labelled list', () => {
    render(<Legend />);
    const list = screen.getByRole('list', { name: 'Legend' });
    const items = within(list).getAllByRole('listitem');
    // Visible label = the item's own text, excluding the aria-hidden icon.
    const labels = items.map((i) =>
      Array.from(i.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim(),
    );
    expect(labels).toEqual(['Wall', 'Enemy', 'Goal', 'Start']);
  });

  it('uses the same shapes as the grid, hidden from assistive tech', () => {
    const { container } = render(<Legend />);
    const icons = container.querySelectorAll('li > svg');
    expect(icons).toHaveLength(4);
    icons.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
    const [wall, enemy, goal, start] = Array.from(icons);
    expect(wall.querySelector('path')).not.toBeNull();
    expect(enemy.querySelector('polygon')?.getAttribute('points')?.split(' ')).toHaveLength(4);
    expect(enemy.querySelector('circle')).not.toBeNull();
    expect(goal.querySelector('polygon')?.getAttribute('points')?.split(' ')).toHaveLength(10);
    expect(start.querySelector('rect')).not.toBeNull();
  });

  it('accepts an extra className', () => {
    render(<Legend className="extra" />);
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveClass('extra');
  });
});

describe('colour tokens contrast', () => {
  // Read from disk: Vitest blanks CSS imports, even with `?raw`.
  const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

  function token(name: string): string {
    const m = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`token ${name} not found`);
    return m[1];
  }
  function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function ratio(a: string, b: string): number {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }

  it.each([
    'color-label',
    'color-wall',
    'color-enemy',
    'color-goal',
    'color-start',
    'color-board-border',
  ])('%s reaches 4.5:1 on the board background', (name) => {
    expect(ratio(token(name), token('color-board-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('enemy mark reaches 4.5:1 on the enemy fill', () => {
    expect(ratio(token('color-enemy-mark'), token('color-enemy'))).toBeGreaterThanOrEqual(4.5);
  });

  it('text reaches 4.5:1 on the page background', () => {
    expect(ratio(token('color-text'), token('color-bg'))).toBeGreaterThanOrEqual(4.5);
  });
});
