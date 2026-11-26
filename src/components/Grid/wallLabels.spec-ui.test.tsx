/**
 * Task #24 — wall piece labels (decision D12): one badge W1 … W8 per wall, drawn on its wall,
 * the wall titles with their piece size, and badges that never hide the goal or an enemy.
 *
 * D1 regression: badges also stay clear of start labels and of each other, inside the board.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  generateBoard,
  mulberry32,
  newCode,
  sideEndpoints,
  type Board,
  type Difficulty,
} from '../../engine';
import { FIXTURE_BOARD } from '../../state/fixtureBoard';
import { CELL } from './geometry';
import { Grid } from './Grid';

const IDS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
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

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function renderSvg(board: Board): SVGSVGElement {
  const { container } = render(<Grid wallLabels board={board} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('no svg');
  return svg;
}

function badges(svg: SVGSVGElement): Map<string, Box> {
  const map = new Map<string, Box>();
  svg.querySelectorAll('[data-wall-label]').forEach((g) => {
    const rect = g.querySelector('rect');
    if (!rect) throw new Error('badge without rect');
    const x = Number(rect.getAttribute('x'));
    const y = Number(rect.getAttribute('y'));
    const box = {
      x0: x,
      y0: y,
      x1: x + Number(rect.getAttribute('width')),
      y1: y + Number(rect.getAttribute('height')),
    };
    map.set(g.getAttribute('data-wall-label') ?? '', box);
  });
  return map;
}

/** Bounding box of an svg polygon `points` attribute. */
function polygonBox(points: string): Box {
  const xy = points
    .trim()
    .split(/\s+/)
    .map((p) => p.split(',').map(Number));
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const intersects = (a: Box, b: Box): boolean =>
  Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

/** Distance from point (x, y) to the segment a–b. */
function distToSegment(x: number, y: number, a: number[], b: number[]): number {
  const [ax, ay] = a;
  const [bx, by] = b;
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
  return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
}

function checkBadges(board: Board, label: string): void {
  const svg = renderSvg(board);
  const group = svg.querySelector('[data-testid="wall-labels"]');
  expect(group, label).not.toBeNull();
  expect(group, label).toHaveAttribute('aria-hidden', 'true');

  const nodes = Array.from(svg.querySelectorAll('[data-wall-label]'));
  expect(nodes.map((n) => n.getAttribute('data-wall-label')).sort(), label).toEqual(IDS);
  nodes.forEach((n) => {
    expect(n.closest('[data-testid="wall-labels"]'), label).toBe(group);
    expect(n.textContent, label).toBe(n.getAttribute('data-wall-label'));
  });

  const boxes = badges(svg);
  for (const wall of board.walls) {
    const box = boxes.get(wall.id)!;
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const d = Math.min(
      ...wall.sides.map((side) => {
        const [a, b] = sideEndpoints(side);
        return distToSegment(cx, cy, [a.px * CELL, a.py * CELL], [b.px * CELL, b.py * CELL]);
      }),
    );
    expect(d, `${label} ${wall.id} badge centre ${cx},${cy} is ${d} from its wall`).toBeLessThan(
      CELL,
    );
  }

  const symbols: { name: string; box: Box }[] = [];
  const goal = svg.querySelector('[data-testid="goal"] polygon');
  symbols.push({ name: 'goal', box: polygonBox(goal?.getAttribute('points') ?? '') });
  svg.querySelectorAll('[data-testid="enemies"] > g').forEach((g) => {
    const poly = g.querySelector('polygon');
    symbols.push({
      name: `enemy ${g.getAttribute('data-cell')}`,
      box: polygonBox(poly?.getAttribute('points') ?? ''),
    });
  });
  expect(symbols).toHaveLength(1 + board.enemies.length);
  const covered: string[] = [];
  for (const [id, box] of boxes) {
    for (const s of symbols) if (intersects(box, s.box)) covered.push(`${id} covers ${s.name}`);
  }
  expect(covered, label).toEqual([]);

  // Start labels ("P1" … "P4", 12 px bold text centred in the cell): about 20 × 16 units.
  const startBoxes: { name: string; box: Box }[] = [];
  svg.querySelectorAll('[data-testid="starts"] text').forEach((t) => {
    const x = Number(t.getAttribute('x'));
    const y = Number(t.getAttribute('y'));
    startBoxes.push({
      name: t.textContent ?? '',
      box: { x0: x - 10, y0: y - 8, x1: x + 10, y1: y + 8 },
    });
  });
  expect(startBoxes, label).toHaveLength(4);
  const soft: string[] = [];
  const all = [...boxes];
  all.forEach(([id, box], i) => {
    for (const st of startBoxes) if (intersects(box, st.box)) soft.push(`${id} covers ${st.name}`);
    for (const [other, ob] of all.slice(i + 1)) {
      if (intersects(box, ob)) soft.push(`${id} overlaps ${other}`);
    }
    if (box.x0 < 0 || box.y0 < 0 || box.x1 > 9 * CELL || box.y1 > 9 * CELL) {
      soft.push(`${id} leaves the board`);
    }
  });
  expect(soft, label).toEqual([]);
}

describe('Grid — wall piece badges', () => {
  it('fixture: W1 … W8 once each, on their wall, covering no goal or enemy', () => {
    checkBadges(FIXTURE_BOARD, 'fixture');
  });

  const cases: [string, number, Difficulty][] = [
    ['K7F2-9QX', 1, 'easy'],
    ['K7F2-9QX', 2, 'medium'],
    ['ABCD-EFG', 1, 'hard'],
    ['HJKM-NPQ', 3, 'hard'],
    ['2345-678', 1, 'medium'],
    ['ZZ9Y-8XW', 2, 'hard'],
    // D1: short walls wrapped around an enemy used to hide part of it.
    ['7MGC-HSC', 2, 'hard'],
    ['JAGE-RTW', 2, 'easy'],
    ['JAGE-RTW', 2, 'medium'],
    ['WAT9-9JV', 1, 'hard'],
  ];
  it.each(cases)('generated %s turn %i %s', (code, turn, difficulty) => {
    checkBadges(generateBoard(code, turn, difficulty), `${code}/${turn}/${difficulty}`);
  });

  it('D1 regression: 300 generated boards, no badge hides a symbol, start label or badge', () => {
    const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    for (let i = 0; i < 100; i++) {
      const code = newCode(mulberry32(i));
      difficulties.forEach((difficulty, d) => {
        const turn = 1 + ((i + d) % 3);
        checkBadges(generateBoard(code, turn, difficulty), `${code}/${turn}/${difficulty}`);
      });
    }
  }, 20_000);

  it('draws badges above the walls (later in document order)', () => {
    const svg = renderSvg(FIXTURE_BOARD);
    const walls = svg.querySelector('[data-testid="walls"]')!;
    const labels = svg.querySelector('[data-testid="wall-labels"]')!;
    expect(walls.compareDocumentPosition(labels) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Grid — wall titles', () => {
  it('names each wall with its piece and size', () => {
    const svg = renderSvg(FIXTURE_BOARD);
    const titles = Array.from(svg.querySelectorAll('[data-wall] > title')).map(
      (t) => t.textContent,
    );
    expect(titles).toEqual(
      FIXTURE_BOARD.walls.map((w) => `Wall ${w.id} (${MM[w.id]}): ${w.sides.join(', ')}`),
    );
    expect(titles[5]).toBe('Wall W6 (88 + 44 mm): B6-S, C6-S, C7-E');
  });

  it('titles generated walls the same way', () => {
    const board = generateBoard('K7F2-9QX', 1, 'hard');
    const svg = renderSvg(board);
    for (const wall of board.walls) {
      const g = svg.querySelector(`[data-wall="${wall.sides.join(' ')}"] > title`);
      expect(g?.textContent).toBe(`Wall ${wall.id} (${MM[wall.id]}): ${wall.sides.join(', ')}`);
    }
  });
});

describe('Grid — no wall names by default (D21)', () => {
  it('draws the walls without their W1 … W8 badges unless asked', () => {
    const { container } = render(<Grid board={FIXTURE_BOARD} />);
    expect(container.querySelector('[data-testid="wall-labels"]')).toBeNull();
    expect(container.querySelector('[data-testid="walls"]')).not.toBeNull();
    // No visible W1 … W8 text (the walls' <title>s, for screen readers, keep their names).
    const visible = [...container.querySelectorAll('text')].map((t) => t.textContent ?? '');
    expect(visible.some((t) => /^W[1-8]$/.test(t.trim()))).toBe(false);
  });
});
