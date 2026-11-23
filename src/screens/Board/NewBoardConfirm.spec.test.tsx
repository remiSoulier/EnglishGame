import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewBoardConfirm } from './NewBoardConfirm';

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<NewBoardConfirm onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel, user: userEvent.setup() };
}

describe('NewBoardConfirm (decision D8, #12)', () => {
  it('is a modal dialog named "Start a new board?" with the explanation', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Start a new board?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByText('The current game will end. Players keep their pawns.'),
    ).toBeInTheDocument();
  });

  it('offers New board then Cancel as native buttons, Cancel focused first', () => {
    setup();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['New board', 'Cancel']);
    buttons.forEach((b) => expect(b.tagName).toBe('BUTTON'));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('New board confirms', async () => {
    const { onConfirm, onCancel, user } = setup();
    await user.click(screen.getByRole('button', { name: 'New board' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Cancel cancels', async () => {
    const { onConfirm, onCancel, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape cancels', async () => {
    const { onConfirm, onCancel, user } = setup();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a tap on the backdrop cancels, a tap inside the dialog does not', async () => {
    const { onConfirm, onCancel, user } = setup();
    await user.click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Tab keeps the focus inside the dialog', async () => {
    const { user } = setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'New board' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'New board' })).toHaveFocus();
  });
});
