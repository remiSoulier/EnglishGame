import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ChoiceKey, Question } from '../../engine';
import { ResultScreen } from './ResultScreen';

const question: Question = {
  id: 501,
  category: 'History',
  difficulty: 'easy',
  question: 'Which one is right?',
  choices: { A: 'Apple', B: 'Banana', C: 'Cherry' },
  answer: 'C',
  explanation: 'Cherry is the right one because of reasons.',
};

function setup({
  answer = 'C' as ChoiceKey,
  correct = true,
  cards = 2,
  player = 1,
  q = question,
} = {}) {
  const onContinue = vi.fn();
  render(
    <ResultScreen
      question={q}
      player={player}
      cards={cards}
      answer={answer}
      correct={correct}
      onContinue={onContinue}
    />,
  );
  return { onContinue, user: userEvent.setup() };
}

const items = () => within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('listitem');
const itemFor = (text: string) => items().find((li) => li.textContent?.includes(text))!;

describe('ResultScreen (spec #14)', () => {
  describe('correct answer', () => {
    it.each([
      [1, 'Draw 1 card'],
      [2, 'Draw 2 cards'],
      [3, 'Draw 3 cards'],
    ])('%i card(s): "Correct!" heading (focused) and "%s"', (cards, draw) => {
      setup({ cards });
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(/Correct!$/);
      expect(h1).toHaveFocus();
      expect(screen.getByText(draw)).toBeInTheDocument();
      expect(screen.queryByText(/No cards/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Wrong answer/)).not.toBeInTheDocument();
    });

    it('labels the right choice as both the correct answer and the player answer', () => {
      setup();
      const right = itemFor('Cherry');
      expect(right).toHaveTextContent('Correct answer · Your answer');
      expect(itemFor('Apple')).not.toHaveTextContent(/answer/);
      expect(itemFor('Banana')).not.toHaveTextContent(/answer/);
    });

    it('shows the question, the explanation and the active player', () => {
      setup({ player: 3 });
      expect(screen.getByText('Player 3')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Which one is right?');
      expect(screen.getByText(question.explanation)).toBeInTheDocument();
    });
  });

  describe('wrong answer', () => {
    it('"Wrong answer" heading (focused), no cards, no "Draw"', () => {
      setup({ answer: 'A', correct: false, cards: 3 });
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(/Wrong answer$/);
      expect(h1).toHaveFocus();
      expect(screen.getByText('No cards this time.')).toBeInTheDocument();
      expect(screen.queryByText(/^Draw/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Correct!/)).not.toBeInTheDocument();
    });

    it('highlights the right answer with its text and marks the player pick (not colour only)', () => {
      setup({ answer: 'A', correct: false });
      const right = itemFor('Cherry');
      expect(right).toHaveTextContent('Correct answer');
      expect(right).not.toHaveTextContent('Your answer');
      const pick = itemFor('Apple');
      expect(pick).toHaveTextContent('Your answer');
      expect(pick).not.toHaveTextContent('Correct answer');
      expect(itemFor('Banana')).not.toHaveTextContent(/answer/);
      // The highlighted and picked items differ from the plain one (not only by text).
      expect(right.className).not.toBe(itemFor('Banana').className);
      expect(pick.className).not.toBe(itemFor('Banana').className);
      expect(pick.className).not.toBe(right.className);
    });

    it('shows the explanation', () => {
      setup({ answer: 'B', correct: false });
      expect(screen.getByText(question.explanation)).toBeInTheDocument();
    });
  });

  it('lists every choice of a 2-choice and a 4-choice question', () => {
    const two: Question = { ...question, choices: { A: 'Yes', B: 'No' }, answer: 'A' };
    setup({ q: two, answer: 'B', correct: false });
    expect(items()).toHaveLength(2);
    cleanup();
    const four: Question = {
      ...question,
      choices: { A: 'w', B: 'x', C: 'y', D: 'z' },
      answer: 'D',
    };
    setup({ q: four, answer: 'D' });
    expect(items()).toHaveLength(4);
  });

  it('Continue is a native button and calls onContinue', async () => {
    const { user, onContinue } = setup();
    const btn = screen.getByRole('button', { name: 'Continue' });
    expect(btn.tagName).toBe('BUTTON');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(btn);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
