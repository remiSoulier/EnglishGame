import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { APP_NAME } from './state/appInfo';
import { LEXICON_STORAGE_KEY } from './state/lexiconProgress';
import { STORAGE_KEY } from './state/storage';

type User = ReturnType<typeof userEvent.setup>;

const h1s = () => screen.getAllByRole('heading', { level: 1 });
const lexiconOpen = () => screen.queryByRole('heading', { level: 1, name: 'Lexicon' }) !== null;

async function systemBack() {
  await act(async () => {
    window.history.back();
    await new Promise((r) => setTimeout(r, 30));
  });
}

async function startGame(user: User) {
  await user.click(screen.getByRole('button', { name: 'New game' }));
  await user.click(screen.getByRole('button', { name: 'Start game' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Turn 1');
}

async function openFromMenu(user: User) {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('menuitem', { name: 'Lexicon' }));
}

describe('Lexicon in the app (D25)', () => {
  beforeEach(() => localStorage.clear());

  it('opens from Home over an inert Home; ‹ returns to Home with focus on Lexicon', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Lexicon' }));
    expect(lexiconOpen()).toBe(true);
    // Home is hidden from assistive tech: only the Lexicon h1 is exposed.
    expect(h1s().map((h) => h.textContent)).toEqual(['Lexicon']);
    expect(screen.getByRole('heading', { name: 'Lexicon' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(lexiconOpen()).toBe(false);
    expect(h1s()[0]).toHaveTextContent(APP_NAME);
    expect(screen.getByRole('button', { name: 'Lexicon' })).toHaveFocus();
  });

  it('opens from the board menu without confirmation; Back returns to the same board', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user);
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    await user.click(screen.getByRole('button', { name: /^Start turn/ }));
    const saved = localStorage.getItem(STORAGE_KEY);
    const grid = screen.getByRole('img', { name: /^Board, turn 2\./ }).getAttribute('aria-label');

    await openFromMenu(user);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(lexiconOpen()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Algorithm learned' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(lexiconOpen()).toBe(false);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Turn 2');
    expect(screen.getByRole('img', { name: /^Board, turn 2\./ })).toHaveAttribute(
      'aria-label',
      grid,
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(localStorage.getItem(LEXICON_STORAGE_KEY)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('See all, then ‹ twice: list → Lexicon → board', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user);
    await openFromMenu(user);
    await user.click(screen.getByRole('button', { name: 'See all' }));
    expect(screen.getByRole('heading', { level: 1, name: 'All concepts' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(lexiconOpen()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Turn 1');
  });

  it('system back: See all → Lexicon → board, game untouched', async () => {
    const user = userEvent.setup();
    render(<App />);
    await startGame(user);
    const saved = localStorage.getItem(STORAGE_KEY);
    await openFromMenu(user);
    await user.click(screen.getByRole('button', { name: 'See all' }));
    await systemBack();
    await waitFor(() => expect(lexiconOpen()).toBe(true));
    await systemBack();
    await waitFor(() => expect(lexiconOpen()).toBe(false));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Turn 1');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });

  it('system back from the Lexicon over Home returns to Home', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Lexicon' }));
    await systemBack();
    await waitFor(() => expect(lexiconOpen()).toBe(false));
    expect(h1s()[0]).toHaveTextContent(APP_NAME);
  });
});
