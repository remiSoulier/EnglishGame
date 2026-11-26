import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { APP_NAME, APP_TAGLINE } from '../../state/appInfo';
import { HomeScreen } from './HomeScreen';

function setup() {
  const onNewGame = vi.fn();
  const onLexicon = vi.fn();
  const utils = render(<HomeScreen onNewGame={onNewGame} onLexicon={onLexicon} />);
  return { ...utils, user: userEvent.setup(), onNewGame, onLexicon };
}

describe('HomeScreen (spec #11)', () => {
  it('shows a decorative logo, the app name as the only h1 and the tagline', () => {
    const { container } = setup();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(APP_NAME);
    expect(screen.getByText(APP_TAGLINE)).toBeInTheDocument();
    const logo = container.querySelector('img[src="/silva-logo.svg"]');
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the three menu entries, in order, as native <button>s', () => {
    setup();
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    const buttons = within(menu).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'New game',
      'How to play (coming soon)',
      'Lexicon',
    ]);
    for (const b of buttons) {
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
    }
  });

  it('New game is enabled and calls onNewGame once per click', async () => {
    const { user, onNewGame } = setup();
    const button = screen.getByRole('button', { name: 'New game' });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onNewGame).toHaveBeenCalledTimes(1);
    await user.click(button);
    expect(onNewGame).toHaveBeenCalledTimes(2);
  });

  it('How to play is disabled and clicking it does nothing', async () => {
    const { user, onNewGame, onLexicon } = setup();
    const button = screen.getByRole('button', { name: /^How to play/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('(coming soon)');
    await user.click(button);
    expect(onNewGame).not.toHaveBeenCalled();
    expect(onLexicon).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
  });

  it('Lexicon is enabled and calls onLexicon (D25)', async () => {
    const { user, onLexicon, onNewGame } = setup();
    const button = screen.getByRole('button', { name: 'Lexicon' });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onLexicon).toHaveBeenCalledTimes(1);
    expect(onNewGame).not.toHaveBeenCalled();
  });

  it('Tab skips How to play: New game, then Lexicon', async () => {
    const { user, onNewGame, onLexicon } = setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'New game' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onNewGame).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Lexicon' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onLexicon).toHaveBeenCalledTimes(1);
  });
});
