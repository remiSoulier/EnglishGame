import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { isValidCode } from '../../engine';
import { chooseCharacters } from '../../test/chooseCharacters';
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
    // D30: no character is chosen at first, so Start game waits for them.
    expect(
      screen.queryAllByRole('radio', { name: /^(Kitkat|Batman|Mushi|Gus)$/, checked: true }),
    ).toHaveLength(0);
    const start = screen.getByRole('button', { name: 'Start game' });
    expect(start).toBeDisabled();
    await chooseCharacters(user, 2);
    await user.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
    const settings = onStart.mock.calls[0][0];
    expect(settings).toMatchObject({ playerCount: 2, difficulty: 'medium' });
    expect(isValidCode(settings.code)).toBe(true);
  });

  it('tapping a chosen character again deselects it; Start waits for every player', async () => {
    const { user, onStart } = setup();
    const p1 = within(screen.getByRole('group', { name: 'Player 1' }));
    const kitkat = p1.getByRole('radio', { name: 'Kitkat' });
    await chooseCharacters(user, 2);
    expect(kitkat).toBeChecked();

    await user.click(kitkat);
    expect(kitkat).not.toBeChecked();
    expect(p1.queryAllByRole('radio', { checked: true })).toHaveLength(0);
    const start = screen.getByRole('button', { name: 'Start game' });
    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription('Choose a character for each player.');
    await user.click(start);
    expect(onStart).not.toHaveBeenCalled();

    // P2's Batman is greyed out for P1; once P2 picks Gus, Batman is free for P1.
    const p2 = within(screen.getByRole('group', { name: 'Player 2' }));
    expect(p1.getByRole('radio', { name: 'Batman' })).toBeDisabled();
    await user.click(p2.getByRole('radio', { name: 'Gus' }));
    expect(p1.getByRole('radio', { name: 'Gus' })).toBeDisabled();
    await user.click(p1.getByRole('radio', { name: 'Batman' }));
    expect(p1.getByRole('radio', { name: 'Batman' })).toBeChecked();
    expect(start).toBeEnabled();
    await user.click(start);
    expect(onStart.mock.calls[0][0].characters).toEqual([1, 3]);
  });

  it('goes back', async () => {
    const { user, onBack } = setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
