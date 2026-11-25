import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { APP_NAME, APP_TAGLINE } from '../../state/appInfo';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('shows the app name, the tagline and the menu', async () => {
    const user = userEvent.setup();
    const onNewGame = vi.fn();
    render(<HomeScreen onNewGame={onNewGame} />);
    expect(APP_NAME).toBe('SILVA');
    expect(APP_TAGLINE).toBe('Program your way to the goal');
    expect(screen.getByRole('heading', { level: 1, name: 'SILVA' })).toBeInTheDocument();
    expect(screen.getByText('Program your way to the goal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /How to play \(coming soon\)/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Lexicon \(coming soon\)/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });
});
