/**
 * Task #30 — board art: the forest texture under the 9×9 cells (clipped to the board), the
 * player characters on the start cells (dashed outline and "P1" … "P4" label kept), the Legend
 * Start icon showing P1's character, the accessible name unchanged, and wall badges that never
 * cover a start cell.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  generateBoard,
  mulberry32,
  newCode,
  START_CELLS,
  type Board,
  type Difficulty,
} from '../../engine';
import { PLAYER_CHARACTERS } from '../../state/players';
import { FIXTURE_BOARD } from '../../state/fixtureBoard';
import { Legend } from '../Legend';
import { CELL } from './geometry';
import { Grid } from './Grid';

const SIZE = CELL * BOARD_SIZE;
const TEXTURE = '/art/board-texture.webp';
/** Start cells in player order, written independently from the engine. */
const START_NAMES = ['A1', 'I9', 'I1', 'A9'];

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const num = (el: Element, attr: string) => Number(el.getAttribute(attr));
const rectBox = (el: Element): Box => ({
  x0: num(el, 'x'),
  y0: num(el, 'y'),
  x1: num(el, 'x') + num(el, 'width'),
  y1: num(el, 'y') + num(el, 'height'),
});
const inside = (inner: Box, outer: Box) =>
  inner.x0 >= outer.x0 && inner.y0 >= outer.y0 && inner.x1 <= outer.x1 && inner.y1 <= outer.y1;
const intersects = (a: Box, b: Box) =>
  Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);
const cellBox = (x: number, y: number): Box => ({
  x0: x * CELL,
  y0: y * CELL,
  x1: (x + 1) * CELL,
  y1: (y + 1) * CELL,
});
/** `true` when `a` comes before `b` in document order (so is painted under it). */
const before = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

function renderGrid(board: Board, playerCount?: 2 | 3 | 4): SVGSVGElement {
  const { container } = render(<Grid board={board} playerCount={playerCount} />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('no svg');
  return svg;
}

describe('Grid — board texture', () => {
  it('draws one texture image, clipped by a nested <svg> to the 9×9 board area', () => {
    const svg = renderGrid(FIXTURE_BOARD);
    const images = [...svg.querySelectorAll('image')].filter(
      (img) => img.getAttribute('href') === TEXTURE,
    );
    expect(images).toHaveLength(1);
    const image = images[0];
    const clip = image.parentElement!;
    expect(clip.tagName.toLowerCase()).toBe('svg');
    expect(clip).not.toBe(svg);
    // A nested <svg> clips its content to its viewport (overflow defaults to hidden).
    expect(rectBox(clip)).toEqual({ x0: 0, y0: 0, x1: SIZE, y1: SIZE });
    expect(clip.getAttribute('overflow') ?? 'hidden').not.toBe('visible');
    expect(clip.getAttribute('style') ?? '').not.toMatch(/overflow\s*:\s*visible/);
    expect(clip).toHaveAttribute('aria-hidden', 'true');
    // The texture fills the nested view box (its drawn lines sit on our cell lines).
    const [vx, vy, vw, vh] = clip.getAttribute('viewBox')!.split(/\s+/).map(Number);
    expect(vw).toBeGreaterThan(0);
    expect(vh).toBeGreaterThan(0);
    const img = rectBox(image);
    expect(Math.abs(img.x0 - vx)).toBeLessThan(5);
    expect(Math.abs(img.y0 - vy)).toBeLessThan(5);
    expect(Math.abs(img.x1 - (vx + vw))).toBeLessThan(5);
    expect(Math.abs(img.y1 - (vy + vh))).toBeLessThan(5);
  });

  it('paints the texture under the grid lines, the veil and every board mark', () => {
    const svg = renderGrid(FIXTURE_BOARD);
    const clip = svg.querySelector(`image[href="${TEXTURE}"]`)!.parentElement!;
    for (const id of ['grid-lines', 'starts', 'goal', 'enemies', 'walls', 'wall-labels']) {
      expect(before(clip, screen.getByTestId(id)), `texture under ${id}`).toBe(true);
    }
    // A full-board veil rect is drawn right after the texture, before the grid lines.
    const veil = clip.nextElementSibling!;
    expect(veil.tagName.toLowerCase()).toBe('rect');
    expect(rectBox(veil)).toEqual({ x0: 0, y0: 0, x1: SIZE, y1: SIZE });
    expect(before(veil, screen.getByTestId('grid-lines'))).toBe(true);
  });

  it('defines a translucent veil and board-coloured outlines on every mark (CSS)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/Grid/Grid.module.css'), 'utf8');
    const rule = (name: string) => {
      const m = css.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`));
      expect(m, `.${name} rule`).not.toBeNull();
      return m![1];
    };
    expect(rule('boardVeil')).toMatch(/fill:\s*var\(--color-board-veil\)/);
    const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    expect(tokens).toMatch(/--color-board-veil:\s*rgb\([^)]*\/\s*40%\)/);
    for (const name of ['enemyBody', 'goal']) {
      expect(rule(name), name).toMatch(/stroke:\s*var\(--color-board-bg\)/);
      expect(rule(name), name).toMatch(/paint-order:\s*stroke/);
    }
    expect(rule('wallHalo')).toMatch(/stroke:\s*var\(--color-board-bg\)/);
    expect(rule('startHalo')).toMatch(/stroke:\s*var\(--color-board-bg\)/);
    expect(rule('start')).toMatch(/stroke-dasharray/);
  });

  it('keeps the accessible name (images are decorative, no extra role)', () => {
    renderGrid(FIXTURE_BOARD, 2);
    const svg = screen.getByRole('img', {
      name: 'Board, turn 1. Goal on E5. Enemies on C3, G7, H2, B5. 8 walls.',
    });
    expect(screen.getAllByRole('img')).toHaveLength(1);
    for (const img of svg.querySelectorAll('image')) {
      expect(img.closest('[aria-hidden="true"]'), img.getAttribute('href')!).not.toBeNull();
    }
  });
});

describe('Grid — player characters on start cells', () => {
  it.each([2, 3, 4] as const)('%i players: one character per start, in player order', (n) => {
    renderGrid(FIXTURE_BOARD, n);
    const starts = [...screen.getByTestId('starts').querySelectorAll(':scope > [data-cell]')];
    expect(starts.map((g) => g.getAttribute('data-cell'))).toEqual(START_NAMES.slice(0, n));
    starts.forEach((g, i) => {
      const name = START_NAMES[i];
      const cell = START_CELLS[i];
      const box = cellBox(cell.x, cell.y);
      expect(g.querySelector('title')).toHaveTextContent(`Start P${i + 1}: ${name}`);
      expect(g.querySelector('title')!.textContent).toBe(`Start P${i + 1}: ${name}`);

      const images = g.querySelectorAll('image');
      expect(images, name).toHaveLength(1);
      expect(images[0]).toHaveAttribute('href', PLAYER_CHARACTERS[i].src);
      expect(images[0]).toHaveAttribute('aria-hidden', 'true');
      expect(inside(rectBox(images[0]), box), `${name}: character inside its cell`).toBe(true);

      // Dashed outline kept (class `start`, see the CSS test), inside the cell.
      const outline = [...g.querySelectorAll('rect')].find((r) =>
        /(^|\s)_?start(_|\s|$)/.test(r.getAttribute('class') ?? ''),
      );
      expect(outline, `${name}: dashed outline`).toBeDefined();
      expect(inside(rectBox(outline!), box)).toBe(true);
      // Outline drawn under the character, character under the label.
      const label = within(g as HTMLElement).getByText(`P${i + 1}`);
      expect(label.tagName.toLowerCase()).toBe('text');
      expect(before(outline!, images[0])).toBe(true);
      expect(before(images[0], label)).toBe(true);
      const lx = num(label, 'x');
      const ly = num(label, 'y');
      expect(lx > box.x0 && lx < box.x1 && ly > box.y0 && ly < box.y1).toBe(true);
    });
  });

  it('defaults to 4 players: kitkat, croco, dragon, toad', () => {
    renderGrid(FIXTURE_BOARD);
    const hrefs = [...screen.getByTestId('starts').querySelectorAll('image')].map((i) =>
      i.getAttribute('href'),
    );
    expect(hrefs).toEqual([
      '/art/char-kitkat.webp',
      '/art/char-croco.webp',
      '/art/char-dragon.webp',
      '/art/char-toad.webp',
    ]);
  });

  it('draws no character anywhere else on the board', () => {
    const svg = renderGrid(FIXTURE_BOARD, 2);
    const chars = [...svg.querySelectorAll('image')].filter((i) =>
      (i.getAttribute('href') ?? '').includes('/char-'),
    );
    expect(chars).toHaveLength(2);
    for (const c of chars) expect(c.closest('[data-testid="starts"]')).not.toBeNull();
  });
});

describe('Legend — Start icon', () => {
  it("shows P1's character (Kitkat) in the Start icon", () => {
    render(<Legend />);
    const item = within(screen.getByRole('list', { name: 'Legend' }))
      .getAllByRole('listitem')
      .find((li) => li.textContent === 'Start')!;
    expect(item).toBeDefined();
    const images = item.querySelectorAll('image');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('href', PLAYER_CHARACTERS[0].src);
    expect(PLAYER_CHARACTERS[0].name).toBe('Kitkat');
    // Still the dashed start square.
    expect(
      [...item.querySelectorAll('rect')].some((r) =>
        /(^|\s)_?start(_|\s|$)/.test(r.getAttribute('class') ?? ''),
      ),
    ).toBe(true);
  });
});

describe('Grid — wall badges never cover a start cell', () => {
  function badgeBoxes(svg: SVGSVGElement): Box[] {
    return [...svg.querySelectorAll('[data-wall-label] rect')].map(rectBox);
  }

  function check(board: Board, playerCount: 2 | 3 | 4, label: string) {
    const svg = renderGrid(board, playerCount);
    const starts = START_CELLS.slice(0, playerCount).map((c) => cellBox(c.x, c.y));
    for (const badge of badgeBoxes(svg)) {
      for (const [i, start] of starts.entries()) {
        expect(intersects(badge, start), `${label}: badge over ${START_NAMES[i]}`).toBe(false);
      }
    }
    svg.ownerDocument.body.innerHTML = '';
  }

  it('fixture board, 2/3/4 players', () => {
    for (const n of [2, 3, 4] as const) check(FIXTURE_BOARD, n, `fixture/${n}p`);
  });

  it('150 generated boards: no badge covers a dashed outline, character or label', () => {
    const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    for (let i = 0; i < 50; i++) {
      const code = newCode(mulberry32(1000 + i));
      difficulties.forEach((difficulty, d) => {
        const turn = 1 + ((i + d) % 4);
        const svg = renderGrid(generateBoard(code, turn, difficulty), 4);
        const marks = [
          ...screen.getByTestId('starts').querySelectorAll(':scope > [data-cell]'),
        ].map((g) => {
          const outline = rectBox(g.querySelector('rect')!);
          // Outline rect grown by half its 2-unit stroke.
          return { x0: outline.x0 - 1, y0: outline.y0 - 1, x1: outline.x1 + 1, y1: outline.y1 + 1 };
        });
        for (const badge of badgeBoxes(svg)) {
          marks.forEach((m, k) => {
            expect(intersects(badge, m), `${code}/${turn}/${difficulty}: P${k + 1}`).toBe(false);
          });
        }
        svg.ownerDocument.body.innerHTML = '';
      });
    }
  }, 30_000);

  it('150 generated boards (4 players): no badge overlaps a whole start cell', () => {
    const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    for (let i = 0; i < 50; i++) {
      const code = newCode(mulberry32(1000 + i));
      difficulties.forEach((difficulty, d) => {
        const turn = 1 + ((i + d) % 4);
        check(generateBoard(code, turn, difficulty), 4, `${code}/${turn}/${difficulty}`);
      });
    }
  }, 30_000);
});
