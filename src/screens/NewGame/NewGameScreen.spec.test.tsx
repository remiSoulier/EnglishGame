import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { isValidCode } from '../../engine';
import { chooseCharacters } from '../../test/chooseCharacters';
import { NewGameScreen, type NewGameSettings } from './NewGameScreen';

function setup() {
  const onStart = vi.fn<(settings: NewGameSettings) => void>();
  const onBack = vi.fn();
  render(<NewGameScreen onStart={onStart} onBack={onBack} />);
  return { user: userEvent.setup(), onStart, onBack };
}

const radio = (name: string) => screen.getByRole('radio', { name });
const start = () => screen.getByRole('button', { name: 'Start game' });

describe('NewGameScreen (spec #11)', () => {
  it('shows the heading, Back, the groups (no Board group, D22) and Start game', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'New game' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    for (const name of ['Players', 'Characters', 'Difficulty']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('group', { name: 'Board' })).not.toBeInTheDocument();
    expect(start()).toHaveAttribute('type', 'submit');
  });

  it('offers 2/3/4 players and Easy/Medium/Hard with the spec defaults, no board code (D22)', () => {
    setup();
    for (const n of ['2', '3', '4']) expect(radio(n)).toBeInTheDocument();
    expect(radio('Easy — 2 enemies')).not.toBeChecked();
    expect(radio('Medium — 4 enemies')).toBeChecked();
    expect(radio('Hard — 6 enemies')).not.toBeChecked();
    expect(radio('2')).toBeChecked();
    expect(radio('3')).not.toBeChecked();
    expect(radio('4')).not.toBeChecked();
    expect(screen.queryByRole('radio', { name: /board/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it.each([
    ['2', 'Easy — 2 enemies', 2, 'easy'],
    ['3', 'Medium — 4 enemies', 3, 'medium'],
    ['4', 'Hard — 6 enemies', 4, 'hard'],
  ] as const)(
    '%s players + %s starts with a random valid canonical code',
    async (players, diff, count, difficulty) => {
      const { user, onStart } = setup();
      await user.click(radio(players));
      await user.click(radio(diff));
      await chooseCharacters(user, count);
      await user.click(start());
      expect(onStart).toHaveBeenCalledTimes(1);
      const settings = onStart.mock.calls[0][0];
      expect(settings).toMatchObject({ playerCount: count, difficulty });
      expect(settings.code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{3}$/);
      expect(isValidCode(settings.code)).toBe(true);
    },
  );

  it('two random starts give different codes', async () => {
    const { user, onStart } = setup();
    await chooseCharacters(user, 2);
    await user.click(start());
    await user.click(start());
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStart.mock.calls[0][0].code).not.toBe(onStart.mock.calls[1][0].code);
  });

  it('radios are reachable with Tab and changed with arrow keys', async () => {
    const { user, onStart } = setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
    await user.tab();
    expect(radio('2')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(radio('3')).toBeChecked();
    await user.keyboard('{ArrowRight}');
    expect(radio('4')).toBeChecked();
    // One tab stop per player's character group (D19). Nothing is chosen yet (D30): Tab lands
    // on the first character still free (taken ones are greyed out, D29), Space picks it.
    for (const [player, name] of ['Kitkat', 'Batman', 'Mushi', 'Gus'].entries()) {
      await user.tab();
      const group = screen.getByRole('group', { name: `Player ${player + 1}` });
      const character = within(group).getByRole('radio', { name });
      expect(character).toHaveFocus();
      expect(character).not.toBeChecked();
      await user.keyboard(' ');
      expect(character).toBeChecked();
    }
    await user.tab();
    expect(radio('Medium — 4 enemies')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(radio('Hard — 6 enemies')).toBeChecked();
    await user.tab();
    expect(start()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0]).toMatchObject({
      playerCount: 4,
      difficulty: 'hard',
      characters: [0, 1, 2, 3],
    });
    expect(isValidCode(onStart.mock.calls[0][0].code)).toBe(true);
  });

  it('Back calls onBack and does not start', async () => {
    const { user, onBack, onStart } = setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('all actions are native <button>s', () => {
    setup();
    for (const b of screen.getAllByRole('button')) expect(b.tagName).toBe('BUTTON');
  });
});
