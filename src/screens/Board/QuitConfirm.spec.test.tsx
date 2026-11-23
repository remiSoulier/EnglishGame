import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuitConfirm } from './QuitConfirm';

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<QuitConfirm onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel, user: userEvent.setup() };
}

describe('QuitConfirm (#12, D10)', () => {
  it('is a modal dialog named "Quit this game?" saying the game is kept', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Quit this game?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByText('The game will be saved. You can continue it from the home screen.'),
    ).toBeInTheDocument();
  });

  it('offers Quit then Cancel as native buttons, Cancel focused first', () => {
    setup();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Quit', 'Cancel']);
    for (const b of buttons) {
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
    }
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('Quit confirms once', async () => {
    const { onConfirm, onCancel, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Quit' }));
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

  it('Enter on the focused Cancel cancels (the default action is the safe one)', async () => {
    const { onConfirm, onCancel, user } = setup();
    await user.keyboard('{Enter}');
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
    expect(screen.getByRole('button', { name: 'Quit' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Quit' })).toHaveFocus();
  });
});
