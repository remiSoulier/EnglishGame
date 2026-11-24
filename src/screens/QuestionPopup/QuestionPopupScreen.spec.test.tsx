import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionPopupScreen } from './QuestionPopupScreen';

function setup(cards = 3) {
  const onShow = vi.fn();
  const onCancel = vi.fn();
  render(<QuestionPopupScreen cards={cards} onShow={onShow} onCancel={onCancel} />);
  return { onShow, onCancel, user: userEvent.setup() };
}

describe('QuestionPopupScreen (spec #13)', () => {
  it.each([
    [1, 'Question for 1 card'],
    [2, 'Question for 2 cards'],
    [3, 'Question for 3 cards'],
  ])('%i card(s): dialog titled exactly "%s" (no player, D11)', (cards, title) => {
    setup(cards);
    const dialog = screen.getByRole('dialog', { name: title });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: title })).toHaveTextContent(
      new RegExp(`^${title}$`),
    );
    expect(screen.queryByText(/Player/)).not.toBeInTheDocument();
  });

  it('offers "Show the question" (focused) and "Cancel" as native buttons', () => {
    setup();
    const show = screen.getByRole('button', { name: 'Show the question' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(show.tagName).toBe('BUTTON');
    expect(cancel.tagName).toBe('BUTTON');
    expect(show).toHaveAttribute('type', 'button');
    expect(show).toHaveFocus();
  });

  it('Show the question calls onShow only', async () => {
    const { user, onShow, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Show the question' }));
    expect(onShow).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Cancel, Escape and the backdrop call onCancel only', async () => {
    const { user, onShow, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onShow).not.toHaveBeenCalled();
  });

  it('keyboard: Enter on the focused button shows the question', async () => {
    const { user, onShow } = setup();
    await user.keyboard('{Enter}');
    expect(onShow).toHaveBeenCalledTimes(1);
  });
});
