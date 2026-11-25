import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EndGameConfirm } from './EndGameConfirm';

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(<EndGameConfirm onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel, user: userEvent.setup(), ...utils };
}

describe('EndGameConfirm (#26, D13)', () => {
  it('is a modal dialog named "End this game?" saying the game is deleted', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'End this game?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'End this game?' })).toBeInTheDocument();
    expect(
      screen.getByText('The game will be deleted. You will go back to the home screen.'),
    ).toBeInTheDocument();
  });

  it('never mentions a winner nor Play again', () => {
    const { container } = setup();
    expect(container.textContent).not.toMatch(/winner|wins|play again/i);
  });

  it('offers End game then Cancel as native buttons, Cancel focused first', () => {
    setup();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['End game', 'Cancel']);
    for (const b of buttons) {
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
    }
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('End game is the primary action, Cancel the secondary one', () => {
    setup();
    const end = screen.getByRole('button', { name: 'End game' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(end.className).toMatch(/primary/);
    expect(cancel.className).toMatch(/secondary/);
    expect(cancel.className).not.toMatch(/primary/);
  });

  it('End game confirms once', async () => {
    const { onConfirm, onCancel, user } = setup();
    await user.click(screen.getByRole('button', { name: 'End game' }));
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
    await user.click(screen.getByText(/The game will be deleted/));
    expect(onCancel).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Tab keeps the focus inside the dialog', async () => {
    const { user } = setup();
    const end = screen.getByRole('button', { name: 'End game' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await user.tab();
    expect(end).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(end).toHaveFocus();
    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(end).toHaveFocus();
  });
});
