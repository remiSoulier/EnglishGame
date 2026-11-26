import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  cellName,
  generateBoard,
  START_CELLS,
  WALL_COUNT,
  type Board,
  type Cell,
  type Difficulty,
  type WallId,
} from '../../engine';
import { BoardScreen } from '../../screens/Board/BoardScreen';
import { NewBoardScreen } from '../../screens/NewBoard/NewBoardScreen';
import { PositionsList, type PositionsListProps } from './PositionsList';

const CODES = ['K7QP2MX', 'ABCDEFG', 'HJKMNPQ', '2345678', 'ZZ9Y8XW'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const IDS: WallId[] = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

function setup(overrides: Partial<PositionsListProps> = {}) {
  const props: PositionsListProps = {
    board: generateBoard('K7QP2MX', 1, 'medium'),
    playerCount: 4,
    ...overrides,
  };
  const utils = render(<PositionsList {...props} />);
  return { props, user: userEvent.setup(), ...utils };
}

function toggle(): HTMLElement {
  return screen.getByRole('button', { name: /^(Show|Hide) positions$/ });
}

function panel(): HTMLElement {
  const id = toggle().getAttribute('aria-controls');
  expect(id).toBeTruthy();
  const el = document.getElementById(id!);
  expect(el).not.toBeNull();
  return el!;
}

/** Map of `<dt>` text → `<dd>` element inside the panel. */
function entries(root: HTMLElement = panel()): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  for (const dt of root.querySelectorAll('dt')) {
    const dd = dt.nextElementSibling;
    expect(dd?.tagName).toBe('DD');
    map.set(dt.textContent!.trim(), dd as HTMLElement);
  }
  return map;
}

const sortCells = (cells: Cell[]) => [...cells].sort((a, b) => a.y - b.y || a.x - b.x);

function expectMatchesBoard(board: Board, playerCount: 2 | 3 | 4, root: HTMLElement = panel()) {
  const map = entries(root);
  expect(map.get('Goal:')).toHaveTextContent(new RegExp(`^${cellName(board.goal)}$`));

  const enemyTerm = board.enemies.length === 1 ? 'Enemy:' : 'Enemies:';
  const other = enemyTerm === 'Enemy:' ? 'Enemies:' : 'Enemy:';
  expect(map.has(other)).toBe(false);
  if (board.enemies.length === 0) {
    expect(map.has('Enemy:')).toBe(false);
    expect(map.has('Enemies:')).toBe(false);
  } else {
    expect(map.get(enemyTerm)!.textContent).toBe(sortCells(board.enemies).map(cellName).join(', '));
  }

  const walls = within(map.get('Walls:')!).getAllByRole('listitem');
  expect(walls).toHaveLength(board.walls.length);
  // One line per piece, in W1 … W8 order, whatever the stored order.
  const byId = new Map(board.walls.map((w) => [w.id, w]));
  const ids = IDS.filter((id) => byId.has(id));
  walls.forEach((li, i) => {
    const wall = byId.get(ids[i])!;
    const cells = [...new Set(wall.sides.map((s) => s.split('-')[0]))];
    expect(li.textContent).toBe(`${wall.id}: ${cells.join(', ')}`);
  });

  const starts = START_CELLS.slice(0, playerCount)
    .map((c, i) => `P${i + 1} ${cellName(c)}`)
    .join(', ');
  expect(map.get('Start:')!.textContent).toBe(starts);
  // No sizes in mm and no compass letters (east / south) in the list.
  expect(root.textContent).not.toMatch(/mm|east|south|-[NESW]\b/);
}

describe('PositionsList: toggle', () => {
  it('is collapsed by default', () => {
    setup();
    const button = toggle();
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent(/^\W*Show positions$/);
    expect(panel()).not.toBeVisible();
    expect(panel()).toHaveAttribute('hidden');
  });

  it('opens and closes on click, updating aria-expanded, label and visibility', async () => {
    const { user } = setup();
    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(toggle()).toHaveAccessibleName('Hide positions');
    expect(panel()).toBeVisible();
    expect(panel()).not.toHaveAttribute('hidden');

    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveAccessibleName('Show positions');
    expect(panel()).not.toBeVisible();
  });

  it('can be toggled with the keyboard', async () => {
    const { user } = setup();
    await user.tab();
    expect(toggle()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('aria-controls targets the panel element, unique per instance', () => {
    const board = generateBoard('K7QP2MX', 1, 'easy');
    render(
      <>
        <PositionsList board={board} playerCount={2} />
        <PositionsList board={board} playerCount={2} />
      </>,
    );
    const ids = screen
      .getAllByRole('button', { name: 'Show positions' })
      .map((b) => b.getAttribute('aria-controls')!);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      const el = document.getElementById(id)!;
      expect(el).not.toBeNull();
      expect(el.querySelector('dl')).not.toBeNull();
    }
  });

  it('defaultOpen opens it on first render', () => {
    setup({ defaultOpen: true });
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(toggle()).toHaveAccessibleName('Hide positions');
    expect(panel()).toBeVisible();
  });
});

describe('PositionsList: content matches the board', () => {
  const cases = CODES.flatMap((code) =>
    DIFFICULTIES.flatMap((difficulty) => [1, 4].map((turn) => ({ code, difficulty, turn }))),
  );

  it.each(cases)('$code / $difficulty / turn $turn', ({ code, difficulty, turn }) => {
    const board = generateBoard(code, turn, difficulty);
    setup({ board, defaultOpen: true });
    expect(board.walls).toHaveLength(WALL_COUNT);
    expectMatchesBoard(board, 4);
    expect(entries().get(board.enemies.length === 1 ? 'Enemy:' : 'Enemies:')).toBeDefined();
  });

  it.each([2, 3, 4] as const)('start cells for %i players', (playerCount) => {
    const board = generateBoard('HJKMNPQ', 2, 'hard');
    setup({ board, playerCount, defaultOpen: true });
    expectMatchesBoard(board, playerCount);
    const text = entries().get('Start:')!.textContent;
    expect(text).toBe(['P1 A1', 'P2 I9', 'P3 I1', 'P4 A9'].slice(0, playerCount).join(', '));
  });

  it('sorts enemies by row then column', () => {
    const board: Board = {
      ...generateBoard('K7QP2MX', 1, 'hard'),
      enemies: [
        { x: 5, y: 6 },
        { x: 2, y: 1 },
        { x: 7, y: 1 },
        { x: 0, y: 6 },
      ],
    };
    setup({ board, defaultOpen: true });
    expect(entries().get('Enemies:')!.textContent).toBe('C2, H2, A7, F7');
  });

  it('uses the singular "Enemy:" for one enemy', () => {
    const board: Board = { ...generateBoard('K7QP2MX', 1, 'easy'), enemies: [{ x: 7, y: 2 }] };
    setup({ board, defaultOpen: true });
    const map = entries();
    expect(map.get('Enemy:')!.textContent).toBe('H3');
    expect(map.has('Enemies:')).toBe(false);
  });

  it('omits the enemy line when there are none', () => {
    const board: Board = { ...generateBoard('K7QP2MX', 1, 'easy'), enemies: [] };
    setup({ board, defaultOpen: true });
    expectMatchesBoard(board, 4);
    expect(screen.queryByText(/^Enem(y|ies):$/)).toBeNull();
  });

  it('writes walls as "Wn: <cells>" in W1 … W8 order, whatever the stored order', () => {
    const base = generateBoard('K7QP2MX', 1, 'medium');
    const board: Board = {
      ...base,
      walls: [
        { id: 'W6', sides: ['C2-E', 'C3-E', 'C3-S'] },
        { id: 'W1', sides: ['B5-S', 'C5-S'] },
      ],
    };
    setup({ board, defaultOpen: true });
    const items = within(entries().get('Walls:')!).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['W1: B5, C5', 'W6: C2, C3']);
  });

  it('lists the eight pieces W1 … W8 once each on generated boards', () => {
    for (const code of CODES) {
      const board = generateBoard(code, 2, 'hard');
      const { unmount } = setup({ board, defaultOpen: true });
      const items = within(entries().get('Walls:')!).getAllByRole('listitem');
      expect(items.map((li) => /^(W\d):/.exec(li.textContent ?? '')?.[1])).toEqual(IDS);
      expect(items[0].textContent).toMatch(/^W1: [A-I][1-9](, [A-I][1-9])*$/);
      expect(items[7].textContent).toMatch(/^W8: /);
      unmount();
    }
  });
});

describe('PositionsList on screens', () => {
  const FIRST = generateBoard('K7QP2MX', 1, 'medium');
  const handlers = {
    onQuestion: vi.fn(),
    onEndTurn: vi.fn(),
    onNewBoard: vi.fn(),
    onEndGame: vi.fn(),
  };

  it('is on the Board screen, collapsed, and updates with the next turn board', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BoardScreen board={FIRST} playerCount={3} {...handlers} />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle());
    expectMatchesBoard(FIRST, 3);

    const next = generateBoard('K7QP2MX', 2, 'medium', FIRST.goal);
    rerender(<BoardScreen board={next} playerCount={3} {...handlers} />);
    expectMatchesBoard(next, 3);
    expect(entries().get('Goal:')!.textContent).toBe(cellName(FIRST.goal));
    expect(next.walls).not.toEqual(FIRST.walls);
  });

  it('is on the New board screen, collapsed by default', async () => {
    const user = userEvent.setup();
    const next = generateBoard('K7QP2MX', 2, 'medium', FIRST.goal);
    render(<NewBoardScreen board={next} playerCount={2} onStartTurn={vi.fn()} />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).not.toBeVisible();
    await user.click(toggle());
    expectMatchesBoard(next, 2);
  });
});
