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
  it('draws the lake scene (D20) over a plain fallback colour', () => {
    expect(rule('screen')).toMatch(/background-color:\s*var\(--color-home-bg\)/);
    expect(rule('scene')).toMatch(/background-image:\s*url\(['"]?\/art\/bg-lake\.webp['"]?\)/);
    // The only art referenced by the Home styles.
    expect(CSS.match(/url\([^)]*\)/g)).toEqual(["url('/art/bg-lake.webp')"]);
  });

  it('draws the art on the <main> screen element', () => {
    const { container } = render(<HomeScreen onNewGame={() => {}} />);
    const main = screen.getByRole('main');
    expect(container.firstElementChild).toBe(main);
    expect(main.className).toMatch(/(^|\s)_?screen(_|\s|$)/);
  });

  it('no longer draws the decorative crescent and dots, nor the old grid logo', () => {
    const { container } = render(<HomeScreen onNewGame={() => {}} />);
    // The only SVGs are the water effects of the lake scene (D20).
    const svgs = [...container.querySelectorAll('svg')];
    expect(svgs.every((svg) => svg.closest('[data-testid="home-scene"]'))).toBe(true);
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

  it('shows the dragon floating over the lake, decorative, still with reduced motion (D19)', () => {
    const { container } = render(<HomeScreen onNewGame={() => {}} />);
    const dragon = container.querySelector('img[src="/art/char-dragon.webp"]')!;
    expect(dragon).not.toBeNull();
    expect(dragon).toHaveAttribute('alt', '');
    expect(dragon).toHaveAttribute('aria-hidden', 'true');
    expect(rule('dragon')).toMatch(/pointer-events:\s*none/);
    expect(CSS).toMatch(/prefers-reduced-motion[\s\S]*\.dragon\s*\{\s*animation:\s*none/);
  });

  it('rocks the moon boat on its own layer, with glints and ripples, all decorative (D20)', () => {
    const { container } = render(<HomeScreen onNewGame={() => {}} />);
    const scene = screen.getByTestId('home-scene');
    expect(scene.closest('[aria-hidden="true"]')).not.toBeNull();
    const boat = scene.querySelector('img')!;
    expect(boat.getAttribute('src')).toBe('/art/scene-boat.webp');
    expect(boat).toHaveAttribute('alt', '');
    expect(rule('boat')).toMatch(/animation:\s*rock/);
    expect(scene.querySelectorAll('line').length).toBeGreaterThanOrEqual(8);
    expect(scene.querySelectorAll('ellipse')).toHaveLength(2);
    expect(rule('sceneBox')).toMatch(/pointer-events:\s*none/);
    expect(container.querySelectorAll('svg[aria-hidden]').length).toBe(0);
    const reduced = CSS.slice(CSS.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/\.boat,\s*\.ripple,\s*\.glint\s*\{\s*animation:\s*none/);
  });
});
