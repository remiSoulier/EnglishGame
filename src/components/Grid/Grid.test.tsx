import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FIXTURE_BOARD } from '../../state/fixtureBoard';
import { Grid } from './Grid';

describe('Grid', () => {
  it('renders an accessible svg summarising the board', () => {
    render(<Grid board={FIXTURE_BOARD} playerCount={2} />);
    const svg = screen.getByRole('img', {
      name: 'Board, turn 1. Goal on E5. Enemies on C3, G7, H2, B5. 8 walls.',
    });
    expect(svg.querySelectorAll('[data-wall]')).toHaveLength(8);
    expect(screen.getByTestId('starts').querySelectorAll('[data-cell]')).toHaveLength(2);
  });
});
