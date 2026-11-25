/**
 * Task #30 — Home background: the forest illustration (public/art/bg-vert.webp) replaces the
 * decorative crescent and dots; the title "SILVA" and the tagline stay, on a dark title card.
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

describe('HomeScreen — forest art background', () => {
  it('uses /art/bg-vert.webp as the screen background, over a plain fallback colour', () => {
    const screenRule = rule('screen');
    expect(screenRule).toMatch(/background-image:[^;]*url\(['"]?\/art\/bg-vert\.webp['"]?\)/);
    expect(screenRule).toMatch(/background-color:\s*var\(--color-home-bg\)/);
    // The only art referenced by the Home styles.
    expect(CSS.match(/url\([^)]*\)/g)).toEqual(["url('/art/bg-vert.webp')"]);
  });

  it('draws the art on the <main> screen element', () => {
    const { container } = render(<HomeScreen onNewGame={() => {}} />);
    const main = screen.getByRole('main');
    expect(container.firstElementChild).toBe(main);
    expect(main.className).toMatch(/(^|\s)_?screen(_|\s|$)/);
  });

  it('no longer draws the decorative crescent and dots', () => {
    const { container } = render(<HomeScreen onNewGame={() => {}} />);
    // The logo is the only svg left (the dots / crescent were circles in a second svg).
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
    expect(svgs[0].closest('header')).not.toBeNull();
    const circles = [...container.querySelectorAll('circle')];
    expect(circles.filter((c) => c.ownerSVGElement !== svgs[0])).toHaveLength(0);
    expect(circles.length).toBeLessThanOrEqual(1); // the logo's start dot
    expect(container.querySelector('[class*="decor"]')).toBeNull();
    expect(CSS).not.toMatch(/\.decor\b/);
    const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    expect(tokens).not.toMatch(/--silva-orange/);
  });

  it('keeps the title "SILVA" and the tagline, together on a dark title card', () => {
    render(<HomeScreen onNewGame={() => {}} />);
    const title = screen.getByRole('heading', { level: 1, name: APP_NAME });
    expect(title).toHaveTextContent('SILVA');
    const tagline = screen.getByText(APP_TAGLINE);
    expect(tagline.parentElement).toBe(title.parentElement);
    expect(title.parentElement!.className).toMatch(/(^|\s)_?titleCard(_|\s|$)/);
    expect(rule('titleCard')).toMatch(/background:\s*var\(--color-home-card\)/);
  });
});
