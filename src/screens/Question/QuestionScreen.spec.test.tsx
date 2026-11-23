import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '../../engine';
import { QuestionScreen } from './QuestionScreen';

const ALL_CHOICES = { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta' } as const;

function makeQuestion(n: 2 | 3 | 4): Question {
  const keys = (['A', 'B', 'C', 'D'] as const).slice(0, n);
  return {
    id: 1000 + n,
    category: 'Concepts',
    difficulty: 'medium',
    question: `A question with ${n} choices?`,
    choices: Object.fromEntries(keys.map((k) => [k, ALL_CHOICES[k]])),
    answer: 'B',
    explanation: 'Because.',
  };
}

function setup(n: 2 | 3 | 4 = 4, player = 3, cards = 2) {
  const onAnswer = vi.fn();
  const question = makeQuestion(n);
  render(<QuestionScreen question={question} player={player} cards={cards} onAnswer={onAnswer} />);
  return { onAnswer, question, user: userEvent.setup() };
}

const choiceButtons = () =>
  within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('button');

describe('QuestionScreen (spec #14)', () => {
  it.each([2, 3, 4] as const)('shows the text and %i choices as buttons, in order', (n) => {
    setup(n);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      `A question with ${n} choices?`,
    );
    const buttons = choiceButtons();
    expect(buttons).toHaveLength(n);
    const expected = (['A', 'B', 'C', 'D'] as const)
      .slice(0, n)
      .map((k) => `${k}: ${ALL_CHOICES[k]}`);
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(expected);
    for (const b of buttons) {
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
      expect(b).toBeEnabled();
    }
  });

  it('shows the active player and the cards at stake', () => {
    setup(4, 3, 1);
    expect(screen.getByText('Player 3 — for 1 card')).toBeInTheDocument();
  });

  it.each([2, 3, 4] as const)('%i choices: each choice answers with its own letter', async (n) => {
    const keys = (['A', 'B', 'C', 'D'] as const).slice(0, n);
    for (const key of keys) {
      const { onAnswer, user, question } = setup(n);
      await user.click(screen.getByRole('button', { name: `${key}: ${question.choices[key]}` }));
      expect(onAnswer).toHaveBeenCalledExactlyOnceWith(key);
      cleanup();
    }
  });

  it('one try: the first tap disables every choice; later taps are ignored', async () => {
    const { onAnswer, user } = setup(4);
    await user.click(screen.getByRole('button', { name: 'C: Charlie' }));
    for (const b of choiceButtons()) expect(b).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'A: Alpha' }));
    await user.click(screen.getByRole('button', { name: 'C: Charlie' }));
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('C');
  });

  it('a double click still answers only once', async () => {
    const { onAnswer, user } = setup(3);
    await user.dblClick(screen.getByRole('button', { name: 'B: Bravo' }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('keyboard: Tab to a choice and Enter answers', async () => {
    const { onAnswer, user } = setup(2);
    await user.tab();
    expect(screen.getByRole('button', { name: 'A: Alpha' })).toHaveFocus();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('B');
  });
});
