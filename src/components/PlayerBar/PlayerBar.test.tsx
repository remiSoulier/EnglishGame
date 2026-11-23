import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerBar } from './PlayerBar';

describe('PlayerBar', () => {
  it.each([2, 3, 4] as const)('renders an ordered list of %i players', (count) => {
    render(<PlayerBar playerCount={count} activePlayer={1} />);
    const list = screen.getByRole('list', { name: 'Players' });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(count);
    items.forEach((item, i) => expect(item).toHaveTextContent(new RegExp(`^P${i + 1}`)));
  });

  it('marks only the active player with aria-current and a hidden text', () => {
    render(<PlayerBar playerCount={4} activePlayer={3} />);
    const items = within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');
    items.forEach((item, i) => {
      if (i === 2) {
        expect(item).toHaveAttribute('aria-current', 'true');
        expect(item).toHaveTextContent('P3 (now playing)');
      } else {
        expect(item).not.toHaveAttribute('aria-current');
        expect(item).not.toHaveTextContent('now playing');
      }
    });
    expect(screen.getAllByText(/now playing/)).toHaveLength(1);
  });

  it('gives the active chip a distinct class (not only an attribute)', () => {
    render(<PlayerBar playerCount={2} activePlayer={2} />);
    const [p1, p2] = within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');
    expect(p2.className).not.toBe(p1.className);
  });

  it('appends a custom class name to the list', () => {
    render(<PlayerBar playerCount={2} activePlayer={1} className="custom" />);
    expect(screen.getByRole('list', { name: 'Players' })).toHaveClass('custom');
  });

  it('marks nobody when the active player is out of range', () => {
    render(<PlayerBar playerCount={2} activePlayer={5} />);
    expect(screen.queryByText(/now playing/)).not.toBeInTheDocument();
  });
});
