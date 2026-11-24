import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ALL_QUESTIONS } from '../../data/questions';
import { QuestionScreen } from './QuestionScreen';

const question = ALL_QUESTIONS[0];

describe('QuestionScreen', () => {
  it('shows the cards, tag, question and one button per choice', () => {
    render(<QuestionScreen question={question} cards={1} onAnswer={vi.fn()} />);
    expect(screen.getByText('For 1 card')).toBeInTheDocument();
    expect(screen.queryByText(/Player/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: question.question })).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(Object.keys(question.choices).length);
    expect(screen.getByRole('button', { name: `A: ${question.choices.A}` })).toBeEnabled();
  });

  it('answers on the first tap only', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<QuestionScreen question={question} cards={2} onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: `B: ${question.choices.B}` }));
    await user.click(screen.getByRole('button', { name: `A: ${question.choices.A}` }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith('B');
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
