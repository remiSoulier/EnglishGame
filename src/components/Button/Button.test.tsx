import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders a real <button> of type "button" by default', () => {
    render(<Button>Question</Button>);
    const button = screen.getByRole('button', { name: 'Question' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('keeps an explicit type and forwards native attributes', () => {
    render(
      <Button type="submit" aria-describedby="hint" disabled>
        Send
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('aria-describedby', 'hint');
    expect(button).toBeDisabled();
  });

  it('calls onClick when clicked or activated with the keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('merges variant, fullWidth and custom class names', () => {
    const { rerender } = render(<Button className="extra">A</Button>);
    const button = screen.getByRole('button', { name: 'A' });
    const base = button.className;
    expect(button).toHaveClass('extra');
    expect(base).not.toMatch(/undefined|false/);

    rerender(
      <Button variant="secondary" fullWidth className="extra">
        A
      </Button>,
    );
    expect(button.className).not.toBe(base);
    expect(button.className.split(/\s+/).length).toBeGreaterThan(base.split(/\s+/).length);
  });
});
