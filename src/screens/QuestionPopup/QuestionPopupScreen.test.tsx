import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionPopupScreen } from './QuestionPopupScreen';

describe('QuestionPopupScreen', () => {
  it('names the cards, singular for 1', () => {
    render(<QuestionPopupScreen cards={1} onShow={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Question for 1 card' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the question' })).toHaveFocus();
  });

  it('fires onShow and onCancel (button and Escape)', async () => {
    const user = userEvent.setup();
    const onShow = vi.fn();
    const onCancel = vi.fn();
    render(<QuestionPopupScreen cards={3} onShow={onShow} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Question for 3 cards' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Show the question' }));
    expect(onShow).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
