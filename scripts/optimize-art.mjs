/**
 * Converts the Figma art (PNG originals in docs/design/art-src/) into optimised WebP files in
 * public/art/, sized for their on-screen use at 2x–3x density:
 * - bg-*.png: full-screen backgrounds, resized to 780 px wide (ratio kept);
 * - board-texture.png: board texture, kept at its size (never upscaled past 720 px);
 * - char-*.png: player tokens, transparent margins trimmed, longest side 256 px;
 * - card-*.png: card backs (question / instruction), longest side 720 px.
 * Alpha is preserved. Needs libwebp's `cwebp` and `dwebp` on the PATH (`brew install webp`).
 *
 * Usage: node scripts/optimize-art.mjs   (or npm run art)
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'docs', 'design', 'art-src');
const OUT_DIR = join(ROOT, 'public', 'art');

const QUALITY = '82';
const BG_WIDTH = 780;
const BOARD_MAX = 720;
const CHAR_MAX = 256;
/** Pixels with alpha at or below this count as transparent when trimming. */
const ALPHA_THRESHOLD = 8;
/** Transparent padding (px, source scale) kept around a trimmed character. */
const TRIM_PADDING = 8;

/** Runs a libwebp tool quietly and returns its stdout. */
function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Decodes a PNG to raw RGBA through a lossless WebP round trip (dwebp -pam), so no image
 * library is needed. Returns { width, height, data }.
 */
async function decodeRgba(png, tmp) {
  const webp = join(tmp, 'decode.webp');
  const pam = join(tmp, 'decode.pam');
  run('cwebp', ['-quiet', '-lossless', '-exact', '-z', '0', png, '-o', webp]);
  run('dwebp', ['-quiet', webp, '-pam', '-o', pam]);
  const buf = await readFile(pam);
  const end = buf.indexOf('ENDHDR\n') + 'ENDHDR\n'.length;
  const header = buf.subarray(0, end).toString('ascii');
  const width = Number(/WIDTH (\d+)/.exec(header)[1]);
  const height = Number(/HEIGHT (\d+)/.exec(header)[1]);
  return { width, height, data: buf.subarray(end) };
}

/** Bounding box of the non-transparent pixels, padded and clamped to the image. */
function opaqueBox({ width, height, data }) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height };
  const x = Math.max(0, minX - TRIM_PADDING);
  const y = Math.max(0, minY - TRIM_PADDING);
  const w = Math.min(width, maxX + 1 + TRIM_PADDING) - x;
  const h = Math.min(height, maxY + 1 + TRIM_PADDING) - y;
  return { x, y, w, h };
}

/** Builds the cwebp crop/resize arguments for one source image. */
async function sizeArgs(name, png, tmp) {
  const img = await decodeRgba(png, tmp);
  if (name.startsWith('bg-')) {
    return img.width > BG_WIDTH ? ['-resize', String(BG_WIDTH), '0'] : [];
  }
  if (name.startsWith('char-')) {
    const box = opaqueBox(img);
    const scale = Math.min(1, CHAR_MAX / Math.max(box.w, box.h));
    const w = Math.round(box.w * scale);
    const h = Math.round(box.h * scale);
    return ['-crop', ...[box.x, box.y, box.w, box.h].map(String), '-resize', String(w), String(h)];
  }
  const longest = Math.max(img.width, img.height);
  if (longest <= BOARD_MAX) return [];
  return img.width >= img.height
    ? ['-resize', String(BOARD_MAX), '0']
    : ['-resize', '0', String(BOARD_MAX)];
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const tmp = await mkdtemp(join(tmpdir(), 'silva-art-'));
  const files = (await readdir(SRC_DIR)).filter((f) => f.endsWith('.png')).sort();
  let before = 0;
  let after = 0;
  try {
    for (const file of files) {
      const name = basename(file, '.png');
      const src = join(SRC_DIR, file);
      const out = join(OUT_DIR, `${name}.webp`);
      const args = await sizeArgs(name, src, tmp);
      run('cwebp', [
        '-quiet',
        '-q',
        QUALITY,
        '-alpha_q',
        '100',
        '-m',
        '6',
        '-sharp_yuv',
        ...args,
        src,
        '-o',
        out,
      ]);
      const inSize = (await stat(src)).size;
      const outSize = (await stat(out)).size;
      before += inSize;
      after += outSize;
      const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
      console.log(`${name.padEnd(18)} ${kb(inSize).padStart(11)} -> ${kb(outSize).padStart(10)}`);
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
  console.log(`total (${files.length} files) ${kb(before)} -> ${kb(after)}`);
}

await main();
