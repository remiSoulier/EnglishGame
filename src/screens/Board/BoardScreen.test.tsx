import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_BOARD } from '../../state/fixtureBoard';
import { BoardScreen, type BoardScreenProps } from './BoardScreen';

function setup(overrides: Partial<BoardScreenProps> = {}) {
  const props: BoardScreenProps = {
    board: FIXTURE_BOARD,
    playerCount: 3,
    activePlayer: 1,
    onQuestion: vi.fn(),
    onNextPlayer: vi.fn(),
    onEndTurn: vi.fn(),
    onNewBoard: vi.fn(),
    onWinner: vi.fn(),
    ...overrides,
  };
  render(<BoardScreen {...props} />);
  return props;
}

describe('BoardScreen', () => {
  it('shows the turn, code, difficulty and Next player before the last player', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeInTheDocument();
    expect(screen.getByText('Code DEMO · Medium')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next player' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End turn' })).not.toBeInTheDocument();
  });

  it('shows End turn for the last player and opens the menu', async () => {
    const user = userEvent.setup();
    const props = setup({ activePlayer: 3 });
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(props.onEndTurn).toHaveBeenCalledTimes(1);

    const menuButton = screen.getByRole('button', { name: 'Menu' });
    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'We have a winner' }));
    expect(props.onWinner).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
