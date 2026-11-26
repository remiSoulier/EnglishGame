import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { isValidCode } from '../../engine';
import { NewGameScreen } from './NewGameScreen';

function setup() {
  const onStart = vi.fn();
  const onBack = vi.fn();
  render(<NewGameScreen onStart={onStart} onBack={onBack} />);
  return { user: userEvent.setup(), onStart, onBack };
}

describe('NewGameScreen', () => {
  it('defaults to 2 players, Medium and always a random board (D22)', async () => {
    const { user, onStart } = setup();
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Medium — 4 enemies' })).toBeChecked();
    // D22: no board choice and no code field; the board is always random.
    expect(screen.queryByRole('radio', { name: /board/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    const settings = onStart.mock.calls[0][0];
    expect(settings).toMatchObject({ playerCount: 2, difficulty: 'medium' });
    expect(isValidCode(settings.code)).toBe(true);
  });

  it('goes back', async () => {
    const { user, onBack } = setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
