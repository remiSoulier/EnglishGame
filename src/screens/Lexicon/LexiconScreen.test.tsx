import { render, screen, within } from '@testing-library/react';
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

describe('LexiconScreen (D25)', () => {
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

  it('opens Loop by default, one card at a time; tapping the open card closes it', async () => {
    const { user } = setup();
    expect(openCards()).toHaveLength(1);
    expect(openCards()[0]).toHaveTextContent('Loop');
    const algorithm = toggle('Algorithm');
    await user.click(algorithm);
    expect(openCards()).toEqual([algorithm]);
    const panel = document.getElementById(algorithm.getAttribute('aria-controls')!);
    expect(panel).toBeVisible();
    await user.click(algorithm);
    expect(openCards()).toHaveLength(0);
    expect(panel).not.toBeVisible();
  });

  it('only one card is open across both sections', async () => {
    const { user } = setup();
    await user.click(toggle('Function'));
    expect(openCards()).toEqual([toggle('Function')]);
  });

  it('the open card shows the explanation, program, result and the character pill', () => {
    setup();
    const loop = LEXICON_CONCEPTS.find((c) => c.id === 'loop')!;
    const panel = document.getElementById(toggle('Loop').getAttribute('aria-controls')!)!;
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
    // Ticking another concept leaves the open card alone.
    expect(openCards()[0]).toHaveTextContent('Loop');
    await user.click(tick);
    expect(stat('Learned')).toBe('0 / 10');
  });

  it('ticking the open concept closes its card, unticking does not reopen it', async () => {
    const { user } = setup();
    expect(openCards()[0]).toHaveTextContent('Loop');
    const tick = screen.getByRole('button', { name: 'Loop learned' });
    await user.click(tick);
    expect(tick).toHaveAttribute('aria-pressed', 'true');
    expect(openCards()).toEqual([]);
    await user.click(tick);
    expect(tick).toHaveAttribute('aria-pressed', 'false');
    expect(openCards()).toEqual([]);
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
