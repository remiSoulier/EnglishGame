import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { PLAYER_CHARACTERS } from '../state/players';

/**
 * New game starts with no character chosen (D30): gives players 1..count their default
 * character (Kitkat, Batman, Mushi, Gus), as a player would tap it.
 */
export async function chooseCharacters(user: UserEvent, count: number): Promise<void> {
  for (let player = 0; player < count; player++) {
    const group = screen.getByRole('group', { name: `Player ${player + 1}` });
    await user.click(within(group).getByRole('radio', { name: PLAYER_CHARACTERS[player].name }));
  }
}
