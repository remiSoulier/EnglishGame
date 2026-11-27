import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HOW_TO_PLAY_STEPS } from '../../data/howToPlay';
import { HowToPlayScreen } from './HowToPlayScreen';

function setup() {
  const onClose = vi.fn();
  const onStartGame = vi.fn();
  const utils = render(<HowToPlayScreen onClose={onClose} onStartGame={onStartGame} />);
  return { ...utils, user: userEvent.setup(), onClose, onStartGame };
}

const stepTitle = () => screen.getByRole('heading', { level: 2 });
const badge = () => screen.getByText(/^Step \d of 6$/);

describe('HowToPlayScreen (D28)', () => {
  it('opens on step 1 with the title focused; Back is disabled', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'How to play' })).toHaveFocus();
    expect(badge()).toHaveTextContent('Step 1 of 6');
    expect(stepTitle()).toHaveTextContent('Set up the board');
    expect(screen.getByText(HOW_TO_PLAY_STEPS[0].text)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('Next and Back walk the 6 steps; each step title gets focus (announced)', async () => {
    const { user } = setup();
    for (let i = 1; i < 6; i++) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(badge()).toHaveTextContent(`Step ${i + 1} of 6`);
      expect(stepTitle()).toHaveTextContent(HOW_TO_PLAY_STEPS[i].title);
      expect(stepTitle()).toHaveFocus();
    }
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Start a game' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(stepTitle()).toHaveTextContent(HOW_TO_PLAY_STEPS[4].title);
  });

  it('← / → move between steps while focus is in the screen, and stop at the ends', async () => {
    const { user } = setup();
    await user.keyboard('{ArrowLeft}');
    expect(badge()).toHaveTextContent('Step 1 of 6');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(badge()).toHaveTextContent('Step 3 of 6');
    await user.keyboard('{ArrowLeft}');
    expect(badge()).toHaveTextContent('Step 2 of 6');
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(badge()).toHaveTextContent('Step 6 of 6');
  });

  it('arrows outside the screen do nothing (no global shortcut)', async () => {
    const { user } = setup();
    (document.activeElement as HTMLElement).blur();
    await user.keyboard('{ArrowRight}');
    expect(badge()).toHaveTextContent('Step 1 of 6');
  });

  it('‹ and Skip close; Start a game opens New game', async () => {
    const { user, onClose, onStartGame } = setup();
    await user.click(screen.getByRole('button', { name: 'Back to home' }));
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start a game' }));
    expect(onStartGame).toHaveBeenCalledTimes(1);
  });

  it('step 2 shows the 3 cards with their alt; other art is decorative', async () => {
    const { user, container } = setup();
    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('alt')).toBe('');
    }
    await user.click(screen.getByRole('button', { name: 'Next' }));
    for (const alt of ['Card: Move forward(1)', 'Card: Turn left(90)', 'Card: Repeat(2)']) {
      expect(screen.getByRole('img', { name: alt })).toBeInTheDocument();
    }
  });

  it('only step 6 has the dark badge; no board code anywhere (D27)', async () => {
    const { user, container } = setup();
    for (let i = 0; i < 6; i++) {
      expect(container.textContent).not.toMatch(/code/i);
      if (i < 5) await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(badge().className).toMatch(/badgeDark/);
  });

  describe('swipe (D35)', () => {
    /** A finger (or a mouse, with `pointerType`) going from x0 to x1, y0 to y1, on `target`. */
    function swipe(x0: number, x1: number, opts: { dy?: number; pointerType?: string } = {}) {
      const target = stepTitle();
      const pointerType = opts.pointerType ?? 'touch';
      const base = { pointerId: 7, isPrimary: true, pointerType };
      fireEvent.pointerDown(target, { ...base, clientX: x0, clientY: 300 });
      fireEvent.pointerUp(target, { ...base, clientX: x1, clientY: 300 + (opts.dy ?? 0) });
    }

    it('swipe left: next step; swipe right: previous step; the new title gets focus', () => {
      setup();
      swipe(300, 100);
      expect(badge()).toHaveTextContent('Step 2 of 6');
      expect(stepTitle()).toHaveTextContent(HOW_TO_PLAY_STEPS[1].title);
      expect(stepTitle()).toHaveFocus();
      swipe(300, 100);
      expect(badge()).toHaveTextContent('Step 3 of 6');
      swipe(100, 300);
      expect(badge()).toHaveTextContent('Step 2 of 6');
    });

    it('stops at the ends: no step before 1, and no game started by swiping past step 6', () => {
      const { onStartGame } = setup();
      swipe(100, 300);
      expect(badge()).toHaveTextContent('Step 1 of 6');
      for (let i = 0; i < 8; i++) swipe(300, 100);
      expect(badge()).toHaveTextContent('Step 6 of 6');
      expect(onStartGame).not.toHaveBeenCalled();
    });

    it('a tap, a short move, a vertical scroll or a mouse drag does not change the step', () => {
      setup();
      swipe(200, 200);
      swipe(200, 170);
      swipe(300, 240, { dy: 250 });
      swipe(300, 100, { pointerType: 'mouse' });
      expect(badge()).toHaveTextContent('Step 1 of 6');
    });
  });
});
