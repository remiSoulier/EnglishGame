import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page, type Response } from '@playwright/test';
import { APP_NAME, startGame, waitForAnimations } from './helpers';

/**
 * Tasks #29 / #30 — Figma art at 390 × 844: the WebP files are precached and actually load
 * (online and offline), the Home text stays readable over the real illustration (measured on
 * the rendered pixels), board marks keep their board-coloured outlines, no horizontal scroll.
 *
 * Browser-side code is passed as strings (the e2e tsconfig has no DOM lib).
 */

const VIEWPORT = { width: 390, height: 844 };
const DIST = new URL('../dist/', import.meta.url);

const ART = [
  'bg-batman',
  'bg-blue-forest',
  'bg-blue-lake',
  'bg-blue-sky',
  'bg-vert',
  'board-texture',
  'card-forward',
  'card-instruction',
  'card-question',
  'card-repeat',
  'card-turn',
  'char-batman',
  'char-croco',
  'char-croque-mort',
  'char-dragon',
  'char-gus',
  'char-kitkat',
  'char-spider',
  'char-toad',
];
const HOME_ART = ['/art/bg-lake.webp', '/art/scene-boat.webp'];
/** How to play (D28): the scene, the six step characters and the cards it draws. */
const HOW_TO_PLAY_ART = [
  '/art/bg-lake.webp',
  '/art/char-kitkat.webp',
  '/art/char-toad.webp',
  '/art/char-gus.webp',
  '/art/char-croco.webp',
  '/art/char-batman.webp',
  '/art/char-dragon.webp',
  '/art/card-forward.webp',
  '/art/card-turn.webp',
  '/art/card-repeat.webp',
  '/art/card-question.webp',
];
/** Distinct art on a 4-player board (D15): texture, 4 players, the dragon goal, 3 enemies. */
const BOARD_ART = [
  '/art/board-texture.webp',
  '/art/char-kitkat.webp',
  '/art/char-batman.webp',
  '/art/char-toad.webp',
  '/art/char-gus.webp',
  '/art/char-dragon.webp',
  '/art/char-croco.webp',
  '/art/char-croque-mort.webp',
  '/art/char-spider.webp',
];
/** Distinct hrefs in first-seen order (enemies cycle through their three characters). */
const distinct = (hrefs: string[]) => [...new Set(hrefs)];
const BOARD_BG = 'rgb(15, 61, 58)';

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

/** Records the responses for /art/*.webp. */
function watchArt(page: Page) {
  const responses: Response[] = [];
  page.on('response', (r) => {
    if (new URL(r.url()).pathname.startsWith('/art/')) responses.push(r);
  });
  return responses;
}

interface Decoded {
  url: string;
  ok: boolean;
  type: string;
  width: number;
  height: number;
}

/** Fetches and decodes each URL in the page (through the service worker when it controls it). */
async function expectDecoded(page: Page, urls: string[], label: string) {
  const results = await page.evaluate<Decoded[]>(`(async () => {
    const out = [];
    for (const url of ${JSON.stringify(urls)}) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        out.push({ url, ok: res.ok, type: blob.type, width: bitmap.width, height: bitmap.height });
      } catch {
        out.push({ url, ok: false, type: '', width: 0, height: 0 });
      }
    }
    return out;
  })()`);
  expect(results).toHaveLength(urls.length);
  for (const r of results) {
    expect(r.ok, `${label}: ${r.url} fetched`).toBe(true);
    expect(r.type, `${label}: ${r.url} type`).toBe('image/webp');
    expect(r.width, `${label}: ${r.url} width`).toBeGreaterThan(0);
    expect(r.height, `${label}: ${r.url} height`).toBeGreaterThan(0);
  }
}

/** naturalWidth of the Home background image, as resolved from the <main> computed style. */
const HOME_BG_SCRIPT = String.raw`(async () => {
  const scene = document.querySelector('[data-testid="home-scene"]');
  const urls = [...getComputedStyle(scene).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)];
  const src = urls.map((m) => m[1]).find((u) => u.endsWith('/art/bg-lake.webp'));
  if (!src) return -1;
  const img = new Image();
  img.src = src;
  await img.decode();
  return img.naturalWidth;
})()`;

interface BoardImage {
  href: string;
  width: number;
  height: number;
}

/** Each SVG <image> of the board: href and drawn size. */
const BOARD_IMAGES_SCRIPT = `[...document.querySelectorAll('svg[role="img"] image')].map((el) => {
  const r = el.getBoundingClientRect();
  return { href: el.getAttribute('href'), width: r.width, height: r.height };
})`;

async function expectNoHorizontalScroll(page: Page, label: string) {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth, `${label}: no horizontal scroll`).toBeLessThanOrEqual(VIEWPORT.width);
}

interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

/**
 * WCAG contrast of each element's text colour against the real pixels behind it: the text is
 * made transparent, the page is captured, and every pixel under the text box is compared.
 * Returns the worst ratio per element.
 */
async function measuredContrast(page: Page, selectors: Record<string, string>) {
  const boxes: Record<string, TextBox> = {};
  for (const [name, selector] of Object.entries(selectors)) {
    await expect(page.locator(selector).first(), name).toBeVisible();
    // Box of the text itself (Range), not of the whole block.
    boxes[name] = await page.evaluate<TextBox>(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, color: getComputedStyle(el).color };
    })()`);
  }
  const MARKER = '/* art-contrast: hidden text */';
  await page.addStyleTag({
    content: [
      MARKER,
      ...Object.values(selectors).map(
        // An image inside (the SILVA logo in the Home <h1>) is hidden too: the contrast measured
        // is its colour (the element's `color`) against the art behind it.
        (s) =>
          `${s}, ${s} * { color: transparent !important; text-shadow: none !important; }\n` +
          `${s} img { visibility: hidden !important; }`,
      ),
    ].join('\n'),
  });
  const png = (await page.screenshot({ animations: 'disabled' })).toString('base64');
  await page.evaluate(`[...document.querySelectorAll('style')]
    .filter((s) => s.textContent.startsWith(${JSON.stringify(MARKER)}))
    .forEach((s) => s.remove())`);

  return page.evaluate<Record<string, { worst: number; samples: number }>>(`(async () => {
    const boxes = ${JSON.stringify(boxes)};
    const img = new Image();
    img.src = 'data:image/png;base64,${png}';
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const scale = img.naturalWidth / window.innerWidth;
    const lum = (r, g, b) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const result = {};
    for (const [name, box] of Object.entries(boxes)) {
      const [r, g, b] = box.color.match(/[\\d.]+/g).map(Number);
      const lt = lum(r, g, b);
      const x0 = Math.max(0, Math.floor(box.x * scale));
      const y0 = Math.max(0, Math.floor(box.y * scale));
      const w = Math.min(canvas.width - x0, Math.ceil(box.width * scale));
      const h = Math.min(canvas.height - y0, Math.ceil(box.height * scale));
      const data = ctx.getImageData(x0, y0, w, h).data;
      let worst = Infinity;
      for (let i = 0; i < data.length; i += 4) {
        const lb = lum(data[i], data[i + 1], data[i + 2]);
        worst = Math.min(worst, (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05));
      }
      result[name] = { worst, samples: data.length / 4 };
    }
    return result;
  })()`);
}

interface Stroke {
  stroke: string;
  width: number;
  order: string;
}

interface Outlines {
  enemies: Stroke[];
  goal: Stroke[];
  walls: number;
  wallHalos: Stroke[];
  wallWidth: number;
  starts: number;
  startHalos: Stroke[];
  startWidth: number;
}

/** Computed outline strokes of the board marks. */
const OUTLINES_SCRIPT = `(() => {
  const svg = document.querySelector('svg[role="img"]');
  const pick = (cls) => [...svg.querySelectorAll('[class*="_' + cls + '_"]')];
  const stroked = (el) => {
    const s = getComputedStyle(el);
    return { stroke: s.stroke, width: parseFloat(s.strokeWidth), order: s.paintOrder };
  };
  return {
    enemies: pick('enemyBack').map(stroked),
    goal: pick('goalBack').map(stroked),
    walls: pick('wall').length,
    wallHalos: pick('wallHalo').map(stroked),
    wallWidth: parseFloat(getComputedStyle(pick('wall')[0]).strokeWidth),
    starts: pick('start').length,
    startHalos: pick('startHalo').map(stroked),
    startWidth: parseFloat(getComputedStyle(pick('start')[0]).strokeWidth),
  };
})()`;

test.use({ viewport: VIEWPORT });

test('dist/sw.js precaches all 19 art files', () => {
  const sw = readFileSync(new URL('sw.js', DIST), 'utf8');
  for (const name of ART) {
    expect(sw, `precache of art/${name}.webp`).toContain(`"art/${name}.webp"`);
  }
});

test('every art file is served as image/webp and decodes', async ({ page, request }) => {
  for (const name of ART) {
    const res = await request.get(`/art/${name}.webp`);
    expect(res.status(), name).toBe(200);
    expect(res.headers()['content-type'], name).toMatch(/^image\/webp/);
  }
  await page.goto('/');
  await expectDecoded(
    page,
    ART.map((n) => `/art/${n}.webp`),
    'online',
  );
});

test('Home: the lake background loads; logo and tagline readable over it', async ({ page }) => {
  const art = watchArt(page);
  await page.goto('/');
  await expect(h1(page)).toHaveText(APP_NAME);
  await expect(page.getByText('Program your way to the goal')).toBeVisible();

  await expect.poll(() => art.map((r) => new URL(r.url()).pathname)).toContain(HOME_ART[0]);
  for (const r of art) expect(r.status(), r.url()).toBe(200);
  expect(await page.evaluate<number>(HOME_BG_SCRIPT)).toBeGreaterThan(0);
  await page.evaluate('document.fonts.ready.then(() => true)');

  const contrast = await measuredContrast(page, {
    title: 'main h1',
    tagline: 'main header p',
    'New game': 'main nav button:not(:disabled)',
  });
  for (const [name, { worst, samples }] of Object.entries(contrast)) {
    expect(samples, `${name}: pixels sampled`).toBeGreaterThan(100);
    expect(worst, `${name}: worst contrast over the art`).toBeGreaterThanOrEqual(4.5);
  }
  await expectNoHorizontalScroll(page, 'Home');

  // With a saved game, "New game" becomes an outlined button straight on the art's veil.
  await startGame(page, { goto: false });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Quit to home' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByRole('button', { name: /^Continue game/ })).toBeVisible();
  const withSaved = await measuredContrast(page, {
    title: 'main h1',
    tagline: 'main header p',
    'Continue game': 'main nav button:nth-child(1)',
    'New game (outlined)': 'main nav button:nth-child(2)',
  });
  for (const [name, { worst, samples }] of Object.entries(withSaved)) {
    expect(samples, `${name}: pixels sampled`).toBeGreaterThan(100);
    expect(worst, `${name}: worst contrast over the art`).toBeGreaterThanOrEqual(4.5);
  }
  await expectNoHorizontalScroll(page, 'Home with Continue game');
});

test('Board: texture and the four characters load; marks keep their outlines', async ({ page }) => {
  const art = watchArt(page);
  await startGame(page, { players: 4, difficulty: 'Hard' });
  await expectNoHorizontalScroll(page, 'Board');

  const paths = () => art.map((r) => new URL(r.url()).pathname);
  for (const url of BOARD_ART) await expect.poll(paths, url).toContain(url);
  for (const r of art) expect(r.status(), r.url()).toBe(200);
  await expectDecoded(page, BOARD_ART, 'board');

  const images = await page.evaluate<BoardImage[]>(BOARD_IMAGES_SCRIPT);
  expect(distinct(images.map((i) => i.href))).toEqual(BOARD_ART);
  for (const i of images) {
    expect(i.width, `${i.href} drawn`).toBeGreaterThan(0);
    expect(i.height, `${i.href} drawn`).toBeGreaterThan(0);
  }
  // Legend Start icon: Kitkat.
  await expect(
    page.getByRole('list', { name: 'Legend' }).locator('image[href="/art/char-kitkat.webp"]'),
  ).toHaveCount(1);

  // Enemy and goal: a plate ringed in their colour (D26: no diamond / star). Walls and start
  // outlines: a wider board-coloured halo drawn under them.
  const o = await page.evaluate<Outlines>(OUTLINES_SCRIPT);
  expect(o.enemies).toHaveLength(6);
  expect(o.goal).toHaveLength(1);
  for (const m of [...o.enemies, ...o.goal]) {
    expect(m.stroke).not.toBe(BOARD_BG);
    expect(m.width).toBeGreaterThan(0);
  }
  expect(o.walls).toBeGreaterThan(0);
  expect(o.wallHalos).toHaveLength(o.walls);
  for (const h of o.wallHalos) {
    expect(h.stroke).toBe(BOARD_BG);
    expect(h.width).toBeGreaterThan(o.wallWidth);
  }
  expect(o.starts).toBe(4);
  expect(o.startHalos).toHaveLength(4);
  for (const h of o.startHalos) {
    expect(h.stroke).toBe(BOARD_BG);
    expect(h.width).toBeGreaterThan(o.startWidth);
  }
});

const HOW = 'main[aria-labelledby="how-title"]';

test('How to play: title, Skip and step badges readable (D28)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(h1(page)).toHaveText('How to play');
  await page.evaluate('document.fonts.ready.then(() => true)');
  for (let step = 1; step <= 6; step++) {
    // Measure once the step has slid in (D35).
    await waitForAnimations(page);
    const selectors: Record<string, string> = {
      [`badge ${step}`]: `${HOW} section > p:first-child`,
    };
    if (step === 1) {
      selectors.title = `${HOW} h1`;
      selectors.Skip = `${HOW} h1 + button`;
    }
    const contrast = await measuredContrast(page, selectors);
    for (const [name, { worst, samples }] of Object.entries(contrast)) {
      expect(samples, `${name}: pixels sampled`).toBeGreaterThan(20);
      expect(worst, `${name}: worst contrast`).toBeGreaterThanOrEqual(4.5);
    }
    await expectNoHorizontalScroll(page, `How to play step ${step}`);
    if (step < 6) await page.getByRole('button', { name: 'Next' }).click();
  }
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });

  async function waitForControl(page: Page) {
    await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
    const controlled = await page.evaluate<boolean>('navigator.serviceWorker.controller !== null');
    if (!controlled) await page.reload();
    await page.waitForFunction("navigator.serviceWorker.controller?.state === 'activated'");
  }

  function failures(context: BrowserContext) {
    const failed: string[] = [];
    context.on('requestfailed', (r) => failed.push(`${r.url()} — ${r.failure()?.errorText}`));
    return failed;
  }

  test('Home background, board texture and characters load from the precache', async ({
    page,
    context,
  }) => {
    const failed = failures(context);
    await page.goto('/');
    await expect(h1(page)).toHaveText(APP_NAME);
    await waitForControl(page);

    await context.setOffline(true);
    const art = watchArt(page);
    await page.reload();
    await expect(h1(page)).toHaveText(APP_NAME);
    expect(await page.evaluate<boolean>('navigator.onLine')).toBe(false);
    expect(await page.evaluate<number>(HOME_BG_SCRIPT)).toBeGreaterThan(0);
    await expectDecoded(page, HOME_ART, 'offline Home');

    await startGame(page, { players: 4, goto: false });
    await expectDecoded(page, BOARD_ART, 'offline board');
    const images = await page.evaluate<BoardImage[]>(BOARD_IMAGES_SCRIPT);
    expect(distinct(images.map((i) => i.href))).toEqual(BOARD_ART);

    const paths = art.map((r) => new URL(r.url()).pathname);
    for (const url of [...HOME_ART, ...BOARD_ART]) expect(paths, url).toContain(url);
    for (const r of art) {
      expect(r.status(), r.url()).toBe(200);
      expect(r.fromServiceWorker(), `${r.url()} from the service worker`).toBe(true);
    }
    expect(failed).toEqual([]);
  });

  test('How to play scene, characters and cards load from the precache (D28)', async ({
    page,
    context,
  }) => {
    const failed = failures(context);
    await page.goto('/');
    await expect(h1(page)).toHaveText(APP_NAME);
    await waitForControl(page);

    await context.setOffline(true);
    const art = watchArt(page);
    await page.reload();
    await page.getByRole('button', { name: 'How to play' }).click();
    for (let step = 1; step < 6; step++) await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('button', { name: 'Start a game' })).toBeVisible();
    await expectDecoded(page, HOW_TO_PLAY_ART, 'offline How to play');

    const paths = art.map((r) => new URL(r.url()).pathname);
    for (const url of HOW_TO_PLAY_ART) expect(paths, url).toContain(url);
    for (const r of art) {
      expect(r.status(), r.url()).toBe(200);
      expect(r.fromServiceWorker(), `${r.url()} from the service worker`).toBe(true);
    }
    expect(failed).toEqual([]);
  });
});
