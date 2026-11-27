import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEXICON_CONCEPTS } from '../../data/lexicon';
import { LEXICON_STORAGE_KEY, saveLearned } from '../../state/lexiconProgress';
import { LexiconScreen, type LexiconView } from './LexiconScreen';

function setup(view: LexiconView = 'main') {
  const onBack = vi.fn();
  const onSeeAll = vi.fn();
  const utils = render(<LexiconScreen view={view} onBack={onBack} onSeeAll={onSeeAll} />);
  return { ...utils, user: userEvent.setup(), onBack, onSeeAll };
}

const toggles = () => Array.from(document.querySelectorAll<HTMLElement>('button[aria-expanded]'));
/** The button that opens or closes the card of `word`. */
const toggle = (word: string) => toggles().find((b) => b.textContent?.startsWith(word))!;
const openCards = () => toggles().filter((b) => b.getAttribute('aria-expanded') === 'true');
const stat = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

describe('LexiconScreen (D25, scroll deck D29)', () => {
  beforeEach(() => localStorage.clear());

  it('shows the header, the 3 stats and the 10 cards in two sections; the dragon is decorative', () => {
    const { container } = setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Lexicon' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    const dragon = container.querySelector('img[src="/art/char-dragon.webp"]');
    expect(dragon).toHaveAttribute('alt', '');
    expect(dragon).toHaveAttribute('aria-hidden', 'true');
    expect(stat('Concepts')).toBe('10');
    expect(stat('Learned')).toBe('0 / 10');
    expect(stat('Level')).toBe('Beginner');
    expect(screen.getByRole('heading', { level: 2, name: 'Basic concepts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Going further' })).toBeInTheDocument();
    const [basic, further] = screen.getAllByRole('list');
    expect(within(basic).getAllByRole('listitem')).toHaveLength(5);
    expect(within(further).getAllByRole('listitem')).toHaveLength(5);
    expect(within(further).getByText('If / Else')).toBeInTheDocument();
    expect(within(further).getByText('Function')).toBeInTheDocument();
    expect(screen.getByText('Algorithm')).toBeInTheDocument();
    expect(screen.getByText('Steps to reach a goal')).toBeInTheDocument();
  });

  it('the first card is at the front (detailed) when the Lexicon opens', () => {
    setup();
    expect(openCards()).toEqual([toggle('Algorithm')]);
    const panel = document.getElementById(toggle('Algorithm').getAttribute('aria-controls')!);
    expect(panel).toBeVisible();
  });

  it('tapping a card brings it to the front, one card at a time; tapping it again keeps it', async () => {
    const { user } = setup();
    const algorithm = document.getElementById(toggle('Algorithm').getAttribute('aria-controls')!);
    const loop = toggle('Loop');
    await user.click(loop);
    expect(openCards()).toEqual([loop]);
    expect(document.getElementById(loop.getAttribute('aria-controls')!)).toBeVisible();
    expect(algorithm).not.toBeVisible();
    await user.click(loop);
    expect(openCards()).toEqual([loop]);
  });

  it('one front card across both sections; the shown section title follows it (D29)', async () => {
    const { user } = setup();
    const basic = screen.getByRole('heading', { level: 2, name: 'Basic concepts' });
    const further = screen.getByRole('heading', { level: 2, name: 'Going further' });
    expect(basic).not.toHaveClass('sr-only');
    expect(further).toHaveClass('sr-only');
    await user.click(toggle('Function'));
    expect(openCards()).toEqual([toggle('Function')]);
    expect(basic).toHaveClass('sr-only');
    expect(further).not.toHaveClass('sr-only');
  });

  it('keyboard focus on a card brings it to the front', async () => {
    const { user } = setup();
    // From the focused h1: See all, Algorithm (title, round), Instruction…
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Algorithm learned' })).toHaveFocus();
    expect(openCards()).toEqual([toggle('Algorithm')]);
    await user.tab();
    expect(toggle('Instruction')).toHaveFocus();
    expect(openCards()).toEqual([toggle('Instruction')]);
  });

  it('the open card shows the explanation, program, result and the character pill', () => {
    setup();
    const loop = LEXICON_CONCEPTS.find((c) => c.id === 'algorithm')!;
    const panel = document.getElementById(toggle('Algorithm').getAttribute('aria-controls')!)!;
    expect(panel.querySelector('pre code')?.textContent).toBe(loop.program);
    expect(within(panel).getByText(/^Result:/)).toBeInTheDocument();
    expect(within(panel).getByText(loop.character.name)).toBeInTheDocument();
  });

  it('marks a concept as learned, saves it apart and updates the counter', async () => {
    const { user } = setup();
    const tick = screen.getByRole('button', { name: 'Algorithm learned' });
    expect(tick).toHaveAttribute('aria-pressed', 'false');
    await user.click(tick);
    expect(tick).toHaveAttribute('aria-pressed', 'true');
    expect(stat('Learned')).toBe('1 / 10');
    expect(JSON.parse(localStorage.getItem(LEXICON_STORAGE_KEY)!)).toEqual({
      version: 1,
      learned: ['algorithm'],
    });
    // Ticking leaves the front card where it is.
    expect(openCards()).toEqual([toggle('Algorithm')]);
    await user.click(tick);
    expect(stat('Learned')).toBe('0 / 10');
  });

  it('tapping the round of a card below does not bring it to the front (the scroll does)', () => {
    setup();
    const tick = screen.getByRole('button', { name: 'Loop learned' });
    // A tap (no keyboard focus, as on a phone).
    fireEvent.click(tick);
    expect(tick).toHaveAttribute('aria-pressed', 'true');
    expect(openCards()).toEqual([toggle('Algorithm')]);
  });

  it('loads saved progress', () => {
    saveLearned(['loop', 'algorithm']);
    setup();
    expect(stat('Learned')).toBe('2 / 10');
    expect(screen.getByRole('button', { name: 'Loop learned' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('Back and See all call their handlers', async () => {
    const { user, onBack, onSeeAll } = setup();
    await user.click(screen.getByRole('button', { name: 'See all' }));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('See all lists the 10 concepts by section with their learned rounds', async () => {
    const { user } = setup('all');
    expect(screen.getByRole('heading', { level: 1, name: 'All concepts' })).toHaveFocus();
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Basic concepts',
      'Going further',
    ]);
    await user.click(screen.getByRole('button', { name: 'Loop learned' }));
    expect(JSON.parse(localStorage.getItem(LEXICON_STORAGE_KEY)!).learned).toEqual(['loop']);
  });
});
