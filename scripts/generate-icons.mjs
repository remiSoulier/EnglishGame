/**
 * Generates the PWA icons in public/icons/ in the SILVA style (D14): a lime rounded-square frame
 * holding a 3×3 grid, a star (goal) and a wall stroke, on the mockup's dark forest green. Uses
 * Playwright's Chromium to rasterise the SVG. Also writes public/favicon.svg: the SILVA logo mark
 * (supplied by the user, D31) in navy on a rounded pale yellow tile.
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

/** SILVA logo mark (user-supplied, D31), in its own 111.75 × 138.75 coordinate space. */
const SILVA_MARK = [
  'M 35.703125 0.640625 C 39.054688 -0.171875 45.21875 -0.566406 46.488281 2.039062 C 47.214844 3.53125 46.242188 5.417969 45.746094 6.316406 C 39.066406 18.320312 21.578125 37.023438 17.203125 54.980469 C 16.375 58.375 13.214844 71.324219 20.515625 79.621094 C 24.460938 84.101562 31.210938 86.941406 37.425781 86.117188 C 46.414062 84.925781 55.589844 75.890625 59.347656 72.1875 C 61.761719 69.8125 64.988281 66.273438 69.191406 66.507812 C 69.578125 66.53125 72.699219 66.75 73.988281 68.882812 C 74.511719 69.75 75.492188 72.179688 69.867188 81.25 C 65.707031 87.960938 63.246094 91.929688 58.089844 95.976562 C 55.828125 97.753906 49.121094 102.890625 39.449219 104.167969 C 27.675781 105.722656 13.035156 101.355469 5.226562 90.199219 C -2.984375 78.464844 0.191406 64.699219 3.296875 51.25 C 5.464844 41.84375 9.3125 34.988281 17.003906 21.269531 C 25.632812 5.890625 30.417969 1.929688 35.703125 0.640625 Z',
  'M 53.585938 64.753906 C 53.585938 64.753906 54.246094 76.976562 38.78125 73.671875 C 23.316406 70.367188 26.769531 53.851562 26.769531 53.851562 C 27.339844 51.421875 30.417969 39.457031 41.90625 32.703125 C 50.894531 27.421875 59.894531 28.347656 63.371094 28.757812 C 70.617188 29.605469 75.691406 32.394531 78.597656 34.027344 C 90.824219 40.902344 97.164062 51.566406 99.984375 57.320312 C 103.601562 65.324219 104.976562 72.011719 105.578125 76.480469 C 106.902344 86.273438 105.328125 91.398438 105.96875 103.710938 C 106.378906 111.5 107.441406 117.746094 108.210938 121.582031 C 111.886719 134.402344 110.851562 137.539062 109.527344 138.269531 C 107.5 139.382812 103.285156 135.695312 101.261719 133.507812 C 96.417969 128.273438 95.222656 122.015625 94.882812 120.097656 C 90.003906 92.664062 91.042969 83.730469 85.175781 71.527344 C 83.917969 68.917969 79.90625 61.078125 71.65625 54.828125 C 65.625 50.257812 61.324219 49.574219 59.507812 49.394531 C 58.785156 49.320312 49.546875 48.515625 46.429688 53.664062 C 45.558594 55.101562 44.890625 57.460938 45.851562 58.644531 C 46.757812 59.765625 48.445312 59.015625 50.335938 59.988281 C 52.257812 60.980469 53.140625 63.117188 53.585938 64.753906 Z',
];

/** Favicon colours (D31, from the user's mockup): chart navy mark on pale yellow. */
const FAVICON_BG = '#f7ef8b';
const FAVICON_MARK = '#00006d';

/** Favicon: the SILVA mark, 48 px tall and centred, on a rounded pale yellow tile (vector). */
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${FAVICON_BG}" />
  <g transform="translate(12.67 8) scale(0.3459)" fill="${FAVICON_MARK}">
${SILVA_MARK.map((d) => `    <path d="${d}" />`).join('\n')}
  </g>
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
