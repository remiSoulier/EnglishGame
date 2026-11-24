/**
 * Task #24 — wall piece labels (decision D12): one badge W1 … W8 per wall, drawn on its wall,
 * the wall titles with their piece size, and badges that never hide the goal or an enemy.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { generateBoard, sideEndpoints, type Board, type Difficulty } from '../../engine';
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
  const { container } = render(<Grid board={board} />);
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
  ];
  it.each(cases)('generated %s turn %i %s', (code, turn, difficulty) => {
    checkBadges(generateBoard(code, turn, difficulty), `${code}/${turn}/${difficulty}`);
  });

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
