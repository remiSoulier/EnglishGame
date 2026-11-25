/**
 * Generates the PWA icons in public/icons/ and public/favicon.svg in the SILVA style (D14):
 * a lime rounded-square frame holding a 3×3 grid, a star (goal) and a wall stroke, on the
 * mockup's dark forest green. Uses Playwright's Chromium to rasterise the SVG.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OUT_DIR = join(ROOT, 'icons');

/** SILVA forest green (--silva-forest in src/styles/tokens.css; manifest theme/background). */
const FOREST = '#0f3d3a';
/** SILVA lime accent (mirrors src/styles/tokens.css). */
const LIME = '#d9f26b';

/** Logo markup in a 64×64 coordinate space: frame, 3×3 grid, wall, star. */
const LOGO = `
  <rect x="4" y="4" width="56" height="56" rx="12" fill="none" stroke="${LIME}" stroke-width="4" />
  <g stroke="${LIME}" stroke-opacity="0.35" stroke-width="1.5">
    <line x1="24.7" y1="8" x2="24.7" y2="56" /><line x1="8" y1="24.7" x2="56" y2="24.7" />
    <line x1="39.3" y1="8" x2="39.3" y2="56" /><line x1="8" y1="39.3" x2="56" y2="39.3" />
  </g>
  <line x1="39.3" y1="28" x2="39.3" y2="52" stroke="${LIME}" stroke-width="4"
    stroke-linecap="round" />
  <path d="M48 11.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L48 23.48l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76z"
    transform="translate(0 -1.5)" fill="${LIME}" />
  <circle cx="16.3" cy="47.7" r="4" fill="${LIME}" />
`;

/**
 * Builds a square SVG: the logo centred on a forest-green background.
 * @param {number} size Output size in px.
 * @param {number} ratio Logo size relative to the icon (maskable icons keep it in the safe zone).
 */
function iconSvg(size, ratio) {
  const logo = size * ratio;
  const offset = (size - logo) / 2;
  const scale = logo / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${FOREST}" />
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

/** Favicon: the logo on a rounded forest-green tile (vector, no rasterisation needed). */
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${FOREST}" />
  <g transform="translate(4 4) scale(0.875)">${LOGO}</g>
</svg>
`;

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(ROOT, 'favicon.svg'), FAVICON);
console.log('wrote public/favicon.svg');
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
