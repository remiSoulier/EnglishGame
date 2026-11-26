/**
 * Task #35 (decision D18) — Figma mockup "4 · Popup": the question card and the result are drawn
 * over the board, in a white card with a navy border; the question card opens on the back of a
 * question card that flips over, without ever blocking taps, and without motion when the user
 * asks for reduced motion. The result shows the instruction card art next to "Draw X cards".
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ALL_QUESTIONS } from '../data/questions';
import { QuestionScreen } from './Question';
import { ResultScreen } from './Result';

const css = (file: string) =>
  readFileSync(resolve(process.cwd(), file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const QUESTION_CSS = css('src/screens/Question/QuestionScreen.module.css');
const RESULT_CSS = css('src/screens/Result/ResultScreen.module.css');

function rule(source: string, selector: string): string {
  const m = source.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
  expect(m, `${selector} rule`).not.toBeNull();
  return m![1];
}

const question = ALL_QUESTIONS[0];

describe('Question card over the board (D18)', () => {
  it('is a fixed overlay with a card inside', () => {
    expect(rule(QUESTION_CSS, '.screen')).toMatch(/position:\s*fixed/);
    expect(rule(QUESTION_CSS, '.card')).toMatch(/border:\s*2px solid var\(--color-primary\)/);
  });

  it('has a decorative card back that never takes taps', () => {
    render(<QuestionScreen question={question} cards={2} onAnswer={vi.fn()} />);
    const back = screen.getByTestId('question-card-back');
    expect(back).toHaveAttribute('aria-hidden', 'true');
    expect(back).toBeEmptyDOMElement();
    const backRule = rule(QUESTION_CSS, '.back');
    expect(backRule).toMatch(/pointer-events:\s*none/);
    expect(backRule).toMatch(/url\(['"]?\/art\/card-question\.webp['"]?\)/);
    expect(backRule).toMatch(/backface-visibility:\s*hidden/);
  });

  it('flips over, with no animation under prefers-reduced-motion', () => {
    expect(rule(QUESTION_CSS, '.card')).toMatch(/animation:\s*flip-in/);
    expect(QUESTION_CSS).toMatch(/@keyframes flip-in/);
    const reduced = QUESTION_CSS.slice(QUESTION_CSS.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/\.card\s*\{\s*animation:\s*none/);
    expect(reduced).toMatch(/\.back\s*\{\s*display:\s*none/);
  });
});

describe('Result card over the board (D18)', () => {
  it('is a fixed overlay with a card inside', () => {
    expect(rule(RESULT_CSS, '.screen')).toMatch(/position:\s*fixed/);
    expect(rule(RESULT_CSS, '.card')).toMatch(/border:\s*2px solid var\(--color-primary\)/);
  });

  it('shows the instruction card art (decorative) next to "Draw X cards"', () => {
    const { container } = render(
      <ResultScreen
        question={question}
        cards={2}
        answer={question.answer}
        correct
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText('Draw 2 cards')).toBeInTheDocument();
    const art = [...container.querySelectorAll('img')];
    expect(art.length).toBeGreaterThan(0);
    for (const img of art) {
      expect(img.getAttribute('src')).toBe('/art/card-instruction.webp');
      expect(img).toHaveAttribute('alt', '');
      expect(img.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });
});
