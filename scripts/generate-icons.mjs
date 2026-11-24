/**
 * Generates the placeholder PWA icons in public/icons/ from the app logo (3×3 grid + star)
 * drawn on the primary colour. Uses Playwright's Chromium to rasterise the SVG.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/** Primary colour (mirrors --color-primary in src/styles/tokens.css). */
const PRIMARY = '#1d4ed8';

/** Logo markup (mirrors src/components/Logo/Logo.tsx), in a 64×64 coordinate space. */
const LOGO = `
  <rect x="2" y="2" width="60" height="60" rx="8" fill="#ffffff" />
  <g stroke="#c9ced6" stroke-width="1">
    <line x1="22" y1="2" x2="22" y2="62" /><line x1="2" y1="22" x2="62" y2="22" />
    <line x1="42" y1="2" x2="42" y2="62" /><line x1="2" y1="42" x2="62" y2="42" />
  </g>
  <rect x="40" y="20" width="4" height="24" rx="1.5" fill="#1f2937" />
  <path d="M52 15.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L52 27.48l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76z"
    transform="translate(0 -9)" fill="#047857" />
  <circle cx="12" cy="52" r="5" fill="${PRIMARY}" />
  <rect x="2" y="2" width="60" height="60" rx="8" fill="none" stroke="#5b6470" stroke-width="2" />
`;

/**
 * Builds a square SVG: the logo centred on a primary background.
 * @param {number} size Output size in px.
 * @param {number} ratio Logo size relative to the icon (maskable icons keep it in the safe zone).
 */
function iconSvg(size, ratio) {
  const logo = size * ratio;
  const offset = (size - logo) / 2;
  const scale = logo / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${PRIMARY}" />
  <g transform="translate(${offset} ${offset}) scale(${scale})">${LOGO}</g>
</svg>`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, ratio: 0.75 },
  { file: 'icon-512.png', size: 512, ratio: 0.75 },
  // Maskable: the logo stays within the 80% safe zone circle (diagonal of 0.56 ≈ 0.79).
  { file: 'icon-maskable-512.png', size: 512, ratio: 0.56 },
  { file: 'apple-touch-icon-180.png', size: 180, ratio: 0.75 },
];

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { file, size, ratio } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<!doctype html><html><body style="margin:0">${iconSvg(size, ratio)}</body></html>`,
    );
    const png = await page.locator('svg').screenshot({ omitBackground: false });
    await writeFile(join(OUT_DIR, file), png);
    console.log(`wrote public/icons/${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
