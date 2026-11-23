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
  it('defaults to 2 players, Medium and a random board', async () => {
    const { user, onStart } = setup();
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Medium — 4 enemies' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Random board' })).toBeChecked();
    expect(screen.queryByLabelText('Board code')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    const settings = onStart.mock.calls[0][0];
    expect(settings).toMatchObject({ playerCount: 2, difficulty: 'medium' });
    expect(isValidCode(settings.code)).toBe(true);
  });

  it('shows an error and keeps focus on an invalid code, then starts with the canonical code', async () => {
    const { user, onStart } = setup();
    await user.click(screen.getByRole('radio', { name: '4' }));
    await user.click(screen.getByRole('radio', { name: 'Hard — 6 enemies' }));
    await user.click(screen.getByRole('radio', { name: 'Enter a board code' }));
    const input = screen.getByLabelText('Board code');
    await user.type(input, 'k7f');
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Code must have 7 characters');
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleDescription('Code must have 7 characters');

    await user.type(input, '29qx');
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(onStart).toHaveBeenCalledWith({ playerCount: 4, difficulty: 'hard', code: 'K7F2-9QX' });
  });

  it('validates the code on blur', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: 'Enter a board code' }));
    await user.type(screen.getByLabelText('Board code'), 'O0O0O0O');
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('Code contains invalid characters');
  });

  it('goes back', async () => {
    const { user, onBack } = setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
