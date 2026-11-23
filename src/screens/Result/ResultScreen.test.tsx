import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ALL_QUESTIONS } from '../../data/questions';
import { choiceKeys } from '../../engine';
import { ResultScreen } from './ResultScreen';

const question = ALL_QUESTIONS[0];
const wrong = choiceKeys(question).find((k) => k !== question.answer)!;

describe('ResultScreen', () => {
  it('correct: focused heading, cards to draw, correct choice labelled', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <ResultScreen
        question={question}
        player={1}
        cards={1}
        answer={question.answer}
        correct
        onContinue={onContinue}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Correct!' })).toHaveFocus();
    expect(screen.getByText('Draw 1 card')).toBeInTheDocument();
    expect(screen.getByText(/Correct answer · Your answer/)).toBeInTheDocument();
    expect(screen.getByText(question.explanation)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('wrong: no cards, right answer and the wrong pick both labelled', () => {
    render(
      <ResultScreen
        question={question}
        player={2}
        cards={3}
        answer={wrong}
        correct={false}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Wrong answer' })).toHaveFocus();
    expect(screen.getByText('No cards this time.')).toBeInTheDocument();
    expect(screen.queryByText(/Draw/)).not.toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Choices' })).getAllByRole('listitem');
    const keys = choiceKeys(question);
    expect(items[keys.indexOf(question.answer)]).toHaveTextContent('Correct answer');
    expect(items[keys.indexOf(wrong)]).toHaveTextContent('Your answer');
  });
});
