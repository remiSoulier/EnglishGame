import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { isValidCode } from '../../engine';
import { NewGameScreen, type NewGameSettings } from './NewGameScreen';

function setup() {
  const onStart = vi.fn<(settings: NewGameSettings) => void>();
  const onBack = vi.fn();
  render(<NewGameScreen onStart={onStart} onBack={onBack} />);
  return { user: userEvent.setup(), onStart, onBack };
}

const radio = (name: string) => screen.getByRole('radio', { name });
const codeBox = () => screen.getByRole('textbox', { name: 'Board code' });
const start = () => screen.getByRole('button', { name: 'Start game' });

describe('NewGameScreen (spec #11)', () => {
  it('shows the heading, Back, the three groups and Start game', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'New game' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    for (const name of ['Players', 'Difficulty', 'Board']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument();
    }
    expect(start()).toHaveAttribute('type', 'submit');
  });

  it('offers 2/3/4 players, Easy/Medium/Hard and Random/code, with the spec defaults', () => {
    setup();
    for (const n of ['2', '3', '4']) expect(radio(n)).toBeInTheDocument();
    expect(radio('Easy — 2 enemies')).not.toBeChecked();
    expect(radio('Medium — 4 enemies')).toBeChecked();
    expect(radio('Hard — 6 enemies')).not.toBeChecked();
    expect(radio('2')).toBeChecked();
    expect(radio('3')).not.toBeChecked();
    expect(radio('4')).not.toBeChecked();
    expect(radio('Random board')).toBeChecked();
    expect(radio('Enter a board code')).not.toBeChecked();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it.each([
    ['2', 'Easy — 2 enemies', 2, 'easy'],
    ['3', 'Medium — 4 enemies', 3, 'medium'],
    ['4', 'Hard — 6 enemies', 4, 'hard'],
  ] as const)(
    '%s players + %s starts with a random valid canonical code',
    async (players, diff, count, difficulty) => {
      const { user, onStart } = setup();
      await user.click(radio(players));
      await user.click(radio(diff));
      await user.click(start());
      expect(onStart).toHaveBeenCalledTimes(1);
      const settings = onStart.mock.calls[0][0];
      expect(settings).toMatchObject({ playerCount: count, difficulty });
      expect(settings.code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{3}$/);
      expect(isValidCode(settings.code)).toBe(true);
    },
  );

  it('two random starts give different codes', async () => {
    const { user, onStart } = setup();
    await user.click(start());
    await user.click(start());
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStart.mock.calls[0][0].code).not.toBe(onStart.mock.calls[1][0].code);
  });

  it('shows the code field only when "Enter a board code" is chosen', async () => {
    const { user } = setup();
    await user.click(radio('Enter a board code'));
    expect(codeBox()).toBeInTheDocument();
    expect(codeBox()).toHaveAttribute('placeholder', 'K7F2-9QX');
    await user.click(radio('Random board'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it.each(['k7f2 9qx', 'K7F2-9QX', 'k7f29qx', ' K7F2 - 9QX '])(
    'entering %j starts K7F2-9QX',
    async (input) => {
      const { user, onStart } = setup();
      await user.click(radio('Enter a board code'));
      await user.type(codeBox(), input);
      await user.click(start());
      expect(onStart).toHaveBeenCalledWith({
        playerCount: 2,
        difficulty: 'medium',
        code: 'K7F2-9QX',
      });
    },
  );

  it.each([
    ['ABC', 'Code must have 7 characters'],
    ['K7F2-0QX', 'Code contains invalid characters'],
    ['', 'Code must have 7 characters'],
    ['K7F2-9QXA', 'Code must have 7 characters'],
    ['K7F2-1QX', 'Code contains invalid characters'],
  ])('code %j on submit: error %j, aria-invalid, focus kept, no start', async (input, message) => {
    const { user, onStart } = setup();
    await user.click(radio('Enter a board code'));
    if (input) await user.type(codeBox(), input);
    await user.click(start());
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(codeBox()).toHaveAttribute('aria-invalid', 'true');
    expect(codeBox()).toHaveAccessibleDescription(message);
    expect(codeBox()).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'New game' })).toBeInTheDocument();
  });

  it('validates on blur (non-empty only) and clears the error when typing', async () => {
    const { user } = setup();
    await user.click(radio('Enter a board code'));
    expect(codeBox()).toHaveAttribute('aria-invalid', 'false');
    // Blur with an empty field: no error.
    codeBox().focus();
    await user.tab();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();

    await user.type(codeBox(), 'K7F2-0QX');
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('Code contains invalid characters');
    expect(codeBox()).toHaveAttribute('aria-invalid', 'true');

    await user.type(codeBox(), '{Backspace}');
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    expect(codeBox()).toHaveAttribute('aria-invalid', 'false');
    expect(codeBox()).not.toHaveAttribute('aria-describedby');
  });

  it('an invalid typed code is ignored when Random board is chosen again', async () => {
    const { user, onStart } = setup();
    await user.click(radio('Enter a board code'));
    await user.type(codeBox(), 'ABC');
    await user.click(radio('Random board'));
    await user.click(start());
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(isValidCode(onStart.mock.calls[0][0].code)).toBe(true);
  });

  it('submits with Enter from the code field', async () => {
    const { user, onStart } = setup();
    await user.click(radio('Enter a board code'));
    await user.type(codeBox(), 'k7f2 9qx{Enter}');
    expect(onStart).toHaveBeenCalledWith({
      playerCount: 2,
      difficulty: 'medium',
      code: 'K7F2-9QX',
    });
  });

  it('radios are reachable with Tab and changed with arrow keys', async () => {
    const { user, onStart } = setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
    await user.tab();
    expect(radio('2')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(radio('3')).toBeChecked();
    await user.keyboard('{ArrowRight}');
    expect(radio('4')).toBeChecked();
    await user.tab();
    expect(radio('Medium — 4 enemies')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(radio('Hard — 6 enemies')).toBeChecked();
    await user.tab();
    expect(radio('Random board')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(radio('Enter a board code')).toBeChecked();
    await user.tab();
    expect(codeBox()).toHaveFocus();
    await user.keyboard('K7F29QX');
    await user.tab();
    expect(start()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onStart).toHaveBeenCalledWith({ playerCount: 4, difficulty: 'hard', code: 'K7F2-9QX' });
  });

  it('Back calls onBack and does not start', async () => {
    const { user, onBack, onStart } = setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('all actions are native <button>s', () => {
    setup();
    for (const b of screen.getAllByRole('button')) expect(b.tagName).toBe('BUTTON');
  });
});
