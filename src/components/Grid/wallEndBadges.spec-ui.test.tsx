/// <reference types="node" />
/**
 * Task #25 regression — wall badges must not hide wall end marks ("rivets").
 *
 * A contact rivet (an end shared by two pieces, or a piece end resting on another piece) must
 * never be under a badge, or the two pieces read as one again. Earlier badge guarantees (task
 * #24, D1) must still hold. Renders Grid exactly as the app does (4 players).
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
import { CELL } from './geometry';
import { Grid } from './Grid';

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface Rivet {
  x: number;
  y: number;
  wall: string;
  contact: boolean;
}

/** Drawn half-extent of a rivet: radius 4.5 plus half of its 2-unit ring. */
const RIVET_HALF = 5.5;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
/** Boards where the validator saw a contact rivet under a badge before the fix. */
const CODES = ['56D8-KRP', '7UP3-6R8', 'J8BA-CM8', 'CSWM-7FU'];
/** Sample size; raise with WALL_END_SAMPLE for a long run. */
const SAMPLE = Number(process.env.WALL_END_SAMPLE ?? 300);

const intersects = (a: Box, b: Box): boolean =>
  Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);

const rivetBox = (r: { x: number; y: number }): Box => ({
  x0: r.x - RIVET_HALF,
  y0: r.y - RIVET_HALF,
  x1: r.x + RIVET_HALF,
  y1: r.y + RIVET_HALF,
});

/** True if SVG point (x, y) lies on one of the wall's side segments (ends included). */
function onWall(x: number, y: number, sides: readonly string[]): boolean {
  return sides.some((s) => {
    const [a, b] = sideEndpoints(s);
    const [ax, ay, bx, by] = [a.px * CELL, a.py * CELL, b.px * CELL, b.py * CELL];
    return (
      x >= Math.min(ax, bx) &&
      x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) &&
      y <= Math.max(ay, by)
    );
  });
}

/** Bounding box of an svg rect (the enemy / goal plate, D26). */
function rectBox(rect: Element): Box {
  const x = Number(rect.getAttribute('x'));
  const y = Number(rect.getAttribute('y'));
  return {
    x0: x,
    y0: y,
    x1: x + Number(rect.getAttribute('width')),
    y1: y + Number(rect.getAttribute('height')),
  };
}

function distToSegment(x: number, y: number, a: number[], b: number[]): number {
  const [ax, ay] = a;
  const [bx, by] = b;
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
  return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
}

interface Report {
  contactCovered: string[];
  freeCovered: string[];
  broken: string[];
  contacts: number;
}

/** Renders the board and lists every badge problem found. */
function inspect(board: Board, label: string): Report {
  const { container, unmount } = render(<Grid wallLabels board={board} />);
  const svg = container.querySelector('svg')!;

  const badges = new Map<string, Box>();
  svg.querySelectorAll('[data-wall-label]').forEach((g) => {
    const r = g.querySelector('rect')!;
    const x = Number(r.getAttribute('x'));
    const y = Number(r.getAttribute('y'));
    badges.set(g.getAttribute('data-wall-label')!, {
      x0: x,
      y0: y,
      x1: x + Number(r.getAttribute('width')),
      y1: y + Number(r.getAttribute('height')),
    });
  });

  const circles = Array.from(svg.querySelectorAll('[data-testid="wall-ends"] circle'));
  const rivets: Rivet[] = circles.map((c, i) => {
    const x = Number(c.getAttribute('cx'));
    const y = Number(c.getAttribute('cy'));
    const own = board.walls[Math.floor(i / 2)];
    const contact = board.walls.some((w) => w !== own && onWall(x, y, w.sides));
    return { x, y, wall: own.id, contact };
  });

  const report: Report = {
    contactCovered: [],
    freeCovered: [],
    broken: [],
    contacts: rivets.filter((r) => r.contact).length,
  };
  if (badges.size !== 8) report.broken.push(`${label}: ${badges.size} badges`);
  if (rivets.length !== 16) report.broken.push(`${label}: ${rivets.length} rivets`);

  for (const [id, box] of badges) {
    for (const r of rivets) {
      if (!intersects(box, rivetBox(r))) continue;
      const msg = `${label}: ${id} badge covers ${r.wall} rivet (${r.x},${r.y})`;
      (r.contact ? report.contactCovered : report.freeCovered).push(msg);
    }
  }

  // Earlier guarantees: symbols, start labels, other badges, board, distance to own wall.
  const symbols: [string, Box][] = [];
  const goal = svg.querySelector('[data-testid="goal"] rect')!;
  symbols.push(['goal', rectBox(goal)]);
  svg.querySelectorAll('[data-testid="enemies"] > g').forEach((g) => {
    symbols.push([`enemy ${g.getAttribute('data-cell')}`, rectBox(g.querySelector('rect')!)]);
  });
  svg.querySelectorAll('[data-testid="starts"] text').forEach((t) => {
    const x = Number(t.getAttribute('x'));
    const y = Number(t.getAttribute('y'));
    symbols.push([t.textContent!, { x0: x - 10, y0: y - 8, x1: x + 10, y1: y + 8 }]);
  });
  const all = [...badges];
  all.forEach(([id, box], i) => {
    for (const [name, s] of symbols) {
      if (intersects(box, s)) report.broken.push(`${label}: ${id} covers ${name}`);
    }
    for (const [other, ob] of all.slice(i + 1)) {
      if (intersects(box, ob)) report.broken.push(`${label}: ${id} overlaps ${other}`);
    }
    if (box.x0 < 0 || box.y0 < 0 || box.x1 > 9 * CELL || box.y1 > 9 * CELL) {
      report.broken.push(`${label}: ${id} leaves the board`);
    }
    const wall = board.walls.find((w) => w.id === id)!;
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const d = Math.min(
      ...wall.sides.map((s) => {
        const [a, b] = sideEndpoints(s);
        return distToSegment(cx, cy, [a.px * CELL, a.py * CELL], [b.px * CELL, b.py * CELL]);
      }),
    );
    if (d >= CELL) report.broken.push(`${label}: ${id} badge is ${d} from its wall`);
  });

  unmount();
  return report;
}

describe('Grid — badges never hide a contact wall end mark', () => {
  const named = CODES.flatMap((code) => DIFFICULTIES.map((d) => [code, d] as const));

  it.each(named)('%s %s turn 1: no rivet under a badge, earlier guarantees kept', (code, d) => {
    const r = inspect(generateBoard(code, 1, d), `${code}/${d}`);
    expect(r.broken).toEqual([]);
    expect(r.contactCovered).toEqual([]);
    expect(r.freeCovered).toEqual([]);
  });

  it('the named boards do have contact rivets (the case under test)', () => {
    for (const code of CODES) {
      const contacts = DIFFICULTIES.map((d) => inspect(generateBoard(code, 1, d), code).contacts);
      expect(Math.max(...contacts), code).toBeGreaterThan(0);
    }
  });

  it(`${SAMPLE} generated boards: no contact rivet or other rivet under a badge`, () => {
    const contactCovered: string[] = [];
    const freeCovered: string[] = [];
    const broken: string[] = [];
    let contacts = 0;
    let withContact = 0;
    for (let i = 0; i < SAMPLE; i++) {
      const code = newCode(mulberry32(5000 + i));
      const difficulty = DIFFICULTIES[i % 3];
      const turn = 1 + (i % 4);
      const r = inspect(generateBoard(code, turn, difficulty), `${code}/${turn}/${difficulty}`);
      contactCovered.push(...r.contactCovered);
      freeCovered.push(...r.freeCovered);
      broken.push(...r.broken);
      contacts += r.contacts;
      if (r.contacts > 0) withContact++;
    }
    if (process.env.WALL_END_SAMPLE) {
      console.log(
        `boards=${SAMPLE} withContact=${withContact} contactRivets=${contacts} ` +
          `contactCovered=${contactCovered.length} freeCovered=${freeCovered.length} ` +
          `broken=${broken.length}`,
      );
    }
    expect(withContact).toBeGreaterThan(0);
    expect(broken).toEqual([]);
    expect(contactCovered).toEqual([]);
    expect(freeCovered).toEqual([]);
  }, 60_000);
});
