/**
 * Task #30, updated by #35 (Figma mockup "1 · Home") — Home background: the night lake with the
 * moon boat (public/art/bg-batman.webp); the title is the SILVA logo (public/silva-logo.svg),
 * the <h1> keeps the text "SILVA" for screen readers, and the tagline sits under it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_TAGLINE } from '../../state/appInfo';
import { HomeScreen } from './HomeScreen';

const CSS = readFileSync(
  resolve(process.cwd(), 'src/screens/Home/HomeScreen.module.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function rule(name: string): string {
  const m = CSS.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`));
  expect(m, `.${name} rule`).not.toBeNull();
  return m![1];
}

describe('HomeScreen — lake art background and SILVA logo', () => {
  it('uses /art/bg-batman.webp as the screen background, over a plain fallback colour', () => {
    const screenRule = rule('screen');
    expect(screenRule).toMatch(/background-image:[^;]*url\(['"]?\/art\/bg-batman\.webp['"]?\)/);
    expect(screenRule).toMatch(/background-color:\s*var\(--color-home-bg\)/);
    // The only art referenced by the Home styles.
    expect(CSS.match(/url\([^)]*\)/g)).toEqual(["url('/art/bg-batman.webp')"]);
  });

  it('draws the art on the <main> screen element', () => {
    const { container } = render(<HomeScreen onNewGame={() => {}} />);
    const main = screen.getByRole('main');
    expect(container.firstElementChild).toBe(main);
    expect(main.className).toMatch(/(^|\s)_?screen(_|\s|$)/);
  });

  it('no longer draws the decorative crescent and dots, nor the old grid logo', () => {
    const { container } = render(<HomeScreen onNewGame={() => {}} />);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
    expect(container.querySelector('[class*="decor"]')).toBeNull();
    expect(CSS).not.toMatch(/\.decor\b/);
    const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    expect(tokens).not.toMatch(/--silva-orange/);
  });

  it('shows the SILVA logo inside the <h1>, decorative, with the text kept for screen readers', () => {
    render(<HomeScreen onNewGame={() => {}} />);
    const title = screen.getByRole('heading', { level: 1, name: APP_NAME });
    expect(title).toHaveTextContent('SILVA');
    const logo = title.querySelector('img')!;
    expect(logo.getAttribute('src')).toBe('/silva-logo.svg');
    expect(logo).toHaveAttribute('alt', '');
    const tagline = screen.getByText(APP_TAGLINE);
    expect(tagline.parentElement).toBe(title.parentElement);
  });
});
