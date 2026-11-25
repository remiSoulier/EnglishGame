import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { generateBoard, newCode, type Question } from '../engine';
import { NewBoardScreen } from './NewBoard';
import { NewGameScreen } from './NewGame';
import { QuestionScreen } from './Question';
import { ResultScreen } from './Result';

/** D14 (SILVA style): visual-only additions that must not change behaviour or names. */

function makeQuestion(overrides: Partial<Question>): Question {
  return {
    id: 9999,
    category: 'Concepts',
    difficulty: 'easy',
    question: 'What is a loop?',
    choices: { A: 'Yes', B: 'No', C: 'Maybe', D: 'Never' },
    answer: 'A',
    explanation: 'Because.',
    ...overrides,
  };
}

const choicesList = () => screen.getByRole('list', { name: 'Choices' });
const isGrid = () => /(^|\s)_?grid(_|\s|$)/.test(choicesList().className);

describe('QuestionScreen — 2×2 grid of choices', () => {
  it('uses the grid for 4 short choices', () => {
    render(<QuestionScreen question={makeQuestion({})} cards={1} onAnswer={vi.fn()} />);
    expect(isGrid()).toBe(true);
  });

  it('uses the grid for 2 short choices', () => {
    const q = makeQuestion({ choices: { A: 'True', B: 'False' } });
    render(<QuestionScreen question={q} cards={1} onAnswer={vi.fn()} />);
    expect(isGrid()).toBe(true);
  });

  it('uses the grid at exactly 12 characters', () => {
    const q = makeQuestion({ choices: { A: 'x'.repeat(12), B: 'y'.repeat(12) } });
    render(<QuestionScreen question={q} cards={1} onAnswer={vi.fn()} />);
    expect(isGrid()).toBe(true);
  });

  it('uses a list for an odd number of short choices', () => {
    const q = makeQuestion({ choices: { A: 'One', B: 'Two', C: 'Three' } });
    render(<QuestionScreen question={q} cards={1} onAnswer={vi.fn()} />);
    expect(isGrid()).toBe(false);
  });

  it('uses a list as soon as one choice is longer than 12 characters', () => {
    const q = makeQuestion({ choices: { A: 'Yes', B: 'No', C: 'Maybe', D: 'x'.repeat(13) } });
    render(<QuestionScreen question={q} cards={1} onAnswer={vi.fn()} />);
    expect(isGrid()).toBe(false);
  });

  it('keeps the button names and count whatever the layout', () => {
    render(<QuestionScreen question={makeQuestion({})} cards={1} onAnswer={vi.fn()} />);
    const buttons = within(choicesList()).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'A: Yes',
      'B: No',
      'C: Maybe',
      'D: Never',
    ]);
  });
});

describe('QuestionScreen — "Read the program:" box', () => {
  it('is absent for a single-line question', () => {
    render(<QuestionScreen question={makeQuestion({})} cards={1} onAnswer={vi.fn()} />);
    expect(screen.queryByText('Read the program:')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'What is a loop?' })).toBeInTheDocument();
  });

  it('is shown for a multi-line question, with the program lines boxed and the prompt last', () => {
    const q = makeQuestion({ question: 'x = 1\nx = x + 2\nWhat is x?' });
    render(<QuestionScreen question={q} cards={2} onAnswer={vi.fn()} />);
    expect(screen.getByText('Read the program:')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('x = 1\nx = x + 2\nWhat is x?');
    const box = heading.querySelector('span');
    expect(box?.textContent).toBe('x = 1\nx = x + 2\n');
    expect(heading.lastChild?.textContent).toBe('What is x?');
  });

  it('shows the "For N cards" pill', () => {
    render(<QuestionScreen question={makeQuestion({})} cards={3} onAnswer={vi.fn()} />);
    expect(screen.getByText('For 3 cards')).toBeInTheDocument();
  });
});

describe('NewBoardScreen — "End of turn N" eyebrow', () => {
  const CODE = newCode(() => 0.5);
  const first = generateBoard(CODE, 1, 'medium');

  it('is hidden on turn 1', () => {
    render(<NewBoardScreen board={first} playerCount={4} onStartTurn={vi.fn()} />);
    expect(screen.queryByText(/^End of turn/i)).not.toBeInTheDocument();
  });

  it.each([2, 3, 7])('reads "End of turn %i − 1" on turn %i', (turn) => {
    const board = generateBoard(CODE, turn, 'medium', first.goal);
    render(<NewBoardScreen board={board} playerCount={4} onStartTurn={vi.fn()} />);
    expect(screen.getByText(`End of turn ${turn - 1}`)).toBeInTheDocument();
    // Only one: the eyebrow is not part of the h1 name.
    expect(screen.getAllByText(/^End of turn/i)).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Walls and enemies have moved' }),
    ).toBeInTheDocument();
  });
});

describe('ResultScreen — cards and "Why?"', () => {
  const q = makeQuestion({});

  it('correct: "Draw N cards" card, its deck line and the "Why?" label', () => {
    render(<ResultScreen question={q} cards={2} answer="A" correct onContinue={vi.fn()} />);
    expect(screen.getByText('Draw 2 cards')).toBeInTheDocument();
    expect(screen.getByText('from the instruction card deck')).toBeInTheDocument();
    expect(screen.getByText('Why?')).toBeInTheDocument();
    expect(screen.getByText('Because.')).toBeInTheDocument();
  });

  it('wrong: no draw card, "Why?" label still present', () => {
    render(<ResultScreen question={q} cards={2} answer="B" correct={false} onContinue={vi.fn()} />);
    expect(screen.queryByText(/^Draw /)).not.toBeInTheDocument();
    expect(screen.queryByText('from the instruction card deck')).not.toBeInTheDocument();
    expect(screen.getByText('No cards this time.')).toBeInTheDocument();
    expect(screen.getByText('Why?')).toBeInTheDocument();
  });
});

describe('icon buttons keep their accessible names', () => {
  it('New game: the "‹" button is named Back', () => {
    render(<NewGameScreen onStart={vi.fn()} onBack={vi.fn()} />);
    const back = screen.getByRole('button', { name: 'Back' });
    expect(back.textContent).toContain('‹');
  });
});

describe('SILVA colour tokens (D14) — the ratios stated in tokens.css hold', () => {
  // Read from disk: Vitest blanks CSS imports, even with `?raw`.
  const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
  const token = (name: string): string => {
    const m = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`token ${name} not found`);
    return m[1];
  };
  const luminance = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string): number => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  it.each([
    // Home: text on the forest background and on the decorative crescent (forest-2).
    ['color-home-title', 'color-home-bg', 4.5],
    ['color-home-text', 'color-home-bg', 4.5],
    ['color-home-tagline', 'color-home-bg', 4.5],
    ['color-home-title', 'silva-forest-2', 4.5],
    ['color-home-text', 'silva-forest-2', 4.5],
    ['color-home-tagline', 'silva-forest-2', 4.5],
    ['color-home-outline', 'color-home-bg', 3],
    ['color-home-outline', 'silva-forest-2', 3],
    // White screens.
    ['color-text-muted', 'color-bg', 4.5],
    ['color-text-muted', 'color-surface', 4.5],
    ['color-text', 'color-surface', 4.5],
    ['color-on-primary', 'color-primary', 4.5],
    ['color-on-primary', 'color-primary-hover', 4.5],
    ['color-on-accent', 'color-accent', 4.5],
    ['color-on-accent', 'color-accent-hover', 4.5],
    ['color-accent-border', 'color-bg', 3],
    ['color-border', 'color-bg', 3],
    ['color-disabled-text', 'color-disabled-bg', 4.5],
    ['color-focus', 'color-bg', 3],
    ['color-focus-on-dark', 'silva-forest', 3],
    // Results.
    ['color-success', 'color-bg', 4.5],
    ['color-success', 'color-success-bg', 4.5],
    ['color-text', 'color-success-bg', 4.5],
    ['color-error', 'color-bg', 4.5],
    ['color-error', 'color-error-bg', 4.5],
    ['color-text', 'color-error-bg', 4.5],
  ] as const)('%s on %s reaches %s:1', (fg, bg, min) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });

  it('theme colour is the forest green', () => {
    expect(token('silva-forest')).toBe('#0f3d3a');
    expect(token('color-board-bg')).toBe('#0f3d3a');
    expect(token('color-home-bg')).toBe('#0f3d3a');
  });
});
