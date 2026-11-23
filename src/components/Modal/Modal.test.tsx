import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

function renderModal(onCancel = vi.fn()) {
  render(
    <Modal labelledBy="t" onCancel={onCancel}>
      <h2 id="t">Title</h2>
      <button type="button" data-autofocus>
        First
      </button>
      <button type="button">Second</button>
    </Modal>,
  );
  return onCancel;
}

describe('Modal', () => {
  it('is a labelled modal dialog with focus moved inside', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Title' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();
  });

  it('cancels on Escape and on a backdrop tap, not on a tap inside', async () => {
    const user = userEvent.setup();
    const onCancel = renderModal();
    await user.click(screen.getByRole('heading', { name: 'Title' }));
    expect(onCancel).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
