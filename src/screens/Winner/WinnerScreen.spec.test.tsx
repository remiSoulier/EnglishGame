import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WinnerScreen, type WinnerScreenProps } from './WinnerScreen';

function setup(overrides: Partial<WinnerScreenProps> = {}) {
  const props: WinnerScreenProps = {
    playerCount: 4,
    winner: null,
    onDeclare: vi.fn(),
    onBack: vi.fn(),
    onPlayAgain: vi.fn(),
    onHome: vi.fn(),
    ...overrides,
  };
  const utils = render(<WinnerScreen {...props} />);
  return { props, user: userEvent.setup(), ...utils };
}

const playerButtons = () => screen.getAllByRole('button', { name: /^Player \d$/ });

describe('WinnerScreen (spec screen 8, #15)', () => {
  describe('step 1: who reached the goal?', () => {
    it('shows "We have a winner" as the only h1, focused, and the question', () => {
      setup();
      const h1s = screen.getAllByRole('heading', { level: 1 });
      expect(h1s).toHaveLength(1);
      expect(h1s[0]).toHaveTextContent(/^We have a winner$/);
      expect(h1s[0]).toHaveFocus();
      expect(screen.getByText('Who reached the goal?')).toBeInTheDocument();
    });

    it.each([2, 3, 4] as const)('lists exactly %i players, in order', (count) => {
      setup({ playerCount: count });
      const buttons = playerButtons();
      expect(buttons).toHaveLength(count);
      buttons.forEach((button, i) => expect(button).toHaveTextContent(`Player ${i + 1}`));
      expect(screen.queryByRole('button', { name: `Player ${count + 1}` })).toBeNull();
    });

    it.each([1, 2, 3, 4])('declaring Player %i calls onDeclare with that number', async (n) => {
      const { props, user } = setup({ playerCount: 4 });
      await user.click(screen.getByRole('button', { name: `Player ${n}` }));
      expect(props.onDeclare).toHaveBeenCalledTimes(1);
      expect(props.onDeclare).toHaveBeenCalledWith(n);
      expect(props.onBack).not.toHaveBeenCalled();
    });

    it('Back calls onBack only', async () => {
      const { props, user } = setup();
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(props.onBack).toHaveBeenCalledTimes(1);
      expect(props.onDeclare).not.toHaveBeenCalled();
    });

    it('does not offer Play again / Home before a winner is declared', () => {
      setup();
      expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Home' })).toBeNull();
    });

    it('all actions are native <button> elements', () => {
      setup();
      for (const button of screen.getAllByRole('button')) {
        expect(button.tagName).toBe('BUTTON');
      }
      expect(screen.getAllByRole('button')).toHaveLength(5);
    });
  });

  describe('step 2: Player X wins!', () => {
    it.each([1, 2, 3, 4])('shows "Player %i wins!" as the focused h1', (n) => {
      setup({ winner: n });
      const h1s = screen.getAllByRole('heading', { level: 1 });
      expect(h1s).toHaveLength(1);
      expect(h1s[0]).toHaveTextContent(new RegExp(`^Player ${n} wins!$`));
      expect(h1s[0]).toHaveFocus();
    });

    it('offers exactly Play again and Home (no player list, no Back)', () => {
      setup({ winner: 2 });
      expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Play again',
        'Home',
      ]);
      expect(screen.queryByText('Who reached the goal?')).toBeNull();
    });

    it('Play again calls onPlayAgain, Home calls onHome', async () => {
      const { props, user } = setup({ winner: 3, playerCount: 3 });
      await user.click(screen.getByRole('button', { name: 'Play again' }));
      expect(props.onPlayAgain).toHaveBeenCalledTimes(1);
      expect(props.onHome).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Home' }));
      expect(props.onHome).toHaveBeenCalledTimes(1);
    });

    it('moves focus to the new heading when the winner is declared', () => {
      const { rerender, props } = setup({ playerCount: 2 });
      rerender(<WinnerScreen {...props} winner={2} />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Player 2 wins!');
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    });

    it('the trophy is decorative (hidden from assistive technology)', () => {
      const { container } = setup({ winner: 1 });
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('img')).toBeNull();
    });
  });
});
