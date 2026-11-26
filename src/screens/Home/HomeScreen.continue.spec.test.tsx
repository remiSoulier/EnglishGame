import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';

function setup(
  savedGame: { turn: number; difficulty: string } | null = { turn: 3, difficulty: 'Medium' },
) {
  const onNewGame = vi.fn();
  const onContinue = vi.fn();
  render(<HomeScreen onNewGame={onNewGame} savedGame={savedGame} onContinue={onContinue} />);
  return { onNewGame, onContinue, user: userEvent.setup() };
}

const menuButtons = () =>
  within(screen.getByRole('navigation', { name: 'Main menu' })).getAllByRole('button');

describe('HomeScreen with a saved game (#12, D10)', () => {
  it('shows "Continue game" with Turn N · difficulty first (no code, D22), then New game', () => {
    setup();
    const buttons = menuButtons();
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Continue gameTurn 3 · Medium',
      'New game',
      'How to play (coming soon)',
      'Lexicon',
    ]);
    expect(buttons[0]).toHaveAccessibleName(/^Continue game/);
    expect(buttons[0]).toHaveTextContent('Turn 3 · Medium');
    for (const b of buttons) {
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
    }
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeEnabled();
  });

  it('Continue game calls onContinue only; New game calls onNewGame only', async () => {
    const { user, onContinue, onNewGame } = setup();
    await user.click(screen.getByRole('button', { name: /^Continue game/ }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onNewGame).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(onNewGame).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('keyboard: Tab reaches Continue game then New game', async () => {
    const { user, onContinue } = setup();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Continue game/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onContinue).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(screen.getByRole('button', { name: 'New game' })).toHaveFocus();
  });

  it('without a saved game there is no Continue game', () => {
    setup(null);
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
    expect(menuButtons()[0]).toHaveTextContent('New game');
  });

  it('without onContinue there is no Continue game', () => {
    render(<HomeScreen onNewGame={vi.fn()} savedGame={{ turn: 1, difficulty: 'Medium' }} />);
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
  });
});
