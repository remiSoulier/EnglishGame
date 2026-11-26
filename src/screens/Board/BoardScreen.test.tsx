import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_BOARD } from '../../state/fixtureBoard';
import { BoardScreen, type BoardScreenProps } from './BoardScreen';

function setup(overrides: Partial<BoardScreenProps> = {}) {
  const props: BoardScreenProps = {
    board: FIXTURE_BOARD,
    playerCount: 3,
    onQuestion: vi.fn(),
    onEndTurn: vi.fn(),
    onNewBoard: vi.fn(),
    onEndGame: vi.fn(),
    ...overrides,
  };
  render(<BoardScreen {...props} />);
  return props;
}

describe('BoardScreen', () => {
  it('shows the turn, difficulty (no code, D22), Question and End turn (no Next player)', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeInTheDocument();
    expect(screen.getByText('Medium', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/DEMO|Code/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Question' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End turn' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next player' })).not.toBeInTheDocument();
  });

  it('End turn fires onEndTurn; the menu opens', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(props.onEndTurn).toHaveBeenCalledTimes(1);

    const menuButton = screen.getByRole('button', { name: 'Menu' });
    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'End game' }));
    expect(props.onEndGame).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
