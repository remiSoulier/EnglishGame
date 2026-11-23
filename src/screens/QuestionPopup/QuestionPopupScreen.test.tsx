import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionPopupScreen } from './QuestionPopupScreen';

describe('QuestionPopupScreen', () => {
  it('names the player and the cards, singular for 1', () => {
    render(<QuestionPopupScreen player={2} cards={1} onShow={vi.fn()} onCancel={vi.fn()} />);
    expect(
      screen.getByRole('dialog', { name: 'Player 2 — Question for 1 card' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the question' })).toHaveFocus();
  });

  it('fires onShow and onCancel (button and Escape)', async () => {
    const user = userEvent.setup();
    const onShow = vi.fn();
    const onCancel = vi.fn();
    render(<QuestionPopupScreen player={1} cards={3} onShow={onShow} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Player 1 — Question for 3 cards' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Show the question' }));
    expect(onShow).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
