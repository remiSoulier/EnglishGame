import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { APP_NAME, chooseCharacters } from './helpers';

const DIST = new URL('../dist/', import.meta.url);

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

const EXPECTED_ICONS: ManifestIcon[] = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height read from the PNG IHDR chunk (bytes 16–23, big-endian). */
function pngSize(body: Buffer): { width: number; height: number } {
  expect([...body.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(body.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

/**
 * Records every request of the context (pages and service worker) and every failure.
 * `foreign` lists the URLs whose origin is not the preview's.
 */
function watchNetwork(context: BrowserContext, origin: string) {
  const urls: string[] = [];
  const failed: string[] = [];
  context.on('request', (request) => urls.push(request.url()));
  context.on('requestfailed', (request) =>
    failed.push(`${request.url()} — ${request.failure()?.errorText ?? '?'}`),
  );
  return {
    urls,
    failed,
    foreign: () =>
      urls.filter((url) => /^(https?|wss?):/.test(url) && new URL(url).origin !== origin),
  };
}

/** Waits until a service worker is active and controls the page (reloading once if needed). */
async function waitForControl(page: Page): Promise<string> {
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  const controlled = await page.evaluate<boolean>('navigator.serviceWorker.controller !== null');
  if (!controlled) await page.reload();
  await page.waitForFunction("navigator.serviceWorker.controller?.state === 'activated'");
  return page.evaluate<string>('navigator.serviceWorker.controller.scriptURL');
}

test.describe('manifest and build output', () => {
  test('manifest is linked, valid and complete; icons are PNGs of the declared size', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await expect(h1(page)).toHaveText(APP_NAME);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).not.toBeNull();
    const manifestUrl = new URL(href!, page.url()).href;
    expect(new URL(manifestUrl).pathname).toBe('/manifest.webmanifest');

    const response = await request.get(manifestUrl);
    expect(response.status()).toBe(200);
    const manifest = JSON.parse(await response.text());
    expect(manifest).toMatchObject({
      name: 'SILVA',
      short_name: 'SILVA',
      lang: 'en',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#0f3d3a',
      background_color: '#0f3d3a',
    });
    expect(manifest.icons).toEqual(EXPECTED_ICONS);

    for (const icon of manifest.icons as ManifestIcon[]) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      expect(res.headers()['content-type'], icon.src).toMatch(/^image\/png/);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(await res.body()), icon.src).toEqual({ width: w, height: h });
    }

    // index.html head: theme-color, description, apple-touch-icon 180.
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0f3d3a');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
    const apple = page.locator('link[rel="apple-touch-icon"]');
    await expect(apple).toHaveAttribute('sizes', '180x180');
    const appleRes = await request.get((await apple.getAttribute('href'))!);
    expect(appleRes.status()).toBe(200);
    expect(pngSize(await appleRes.body())).toEqual({ width: 180, height: 180 });
  });

  test('build output contains the manifest, sw.js and a precache of the app shell', () => {
    for (const file of ['manifest.webmanifest', 'sw.js', 'registerSW.js', 'index.html']) {
      expect(existsSync(new URL(file, DIST)), `dist/${file}`).toBe(true);
    }
    const sw = readFileSync(new URL('sw.js', DIST), 'utf8');
    for (const entry of [
      'index.html',
      'manifest.webmanifest',
      'icons/icon-192.png',
      'icons/icon-512.png',
      'icons/icon-maskable-512.png',
    ]) {
      expect(sw, `precache of ${entry}`).toContain(`"${entry}"`);
    }
    expect(sw).toMatch(/assets\/index-[\w-]+\.js/);
    expect(sw).toMatch(/assets\/index-[\w-]+\.css/);
  });
});

test.describe('service worker and offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('service worker registers, activates and controls the page', async ({
    page,
    context,
    baseURL,
  }) => {
    const net = watchNetwork(context, new URL(baseURL!).origin);
    await page.goto('/');
    await expect(h1(page)).toHaveText(APP_NAME);
    const scriptURL = await waitForControl(page);
    expect(new URL(scriptURL).pathname).toBe('/sw.js');
    const scope = await page.evaluate<string | undefined>(
      'navigator.serviceWorker.getRegistration().then((r) => r?.scope)',
    );
    expect(scope).toBe(`${new URL(baseURL!).origin}/`);
    expect(net.foreign()).toEqual([]);
    expect(net.failed).toEqual([]);
  });

  test('offline: a full game from Home to End game', async ({ page, context, baseURL }) => {
    const net = watchNetwork(context, new URL(baseURL!).origin);
    await page.goto('/');
    await expect(h1(page)).toHaveText(APP_NAME);
    await waitForControl(page);

    await context.setOffline(true);
    await page.reload();
    await expect(h1(page)).toHaveText(APP_NAME);
    expect(await page.evaluate<boolean>('navigator.onLine')).toBe(false);

    // New game: 3 players, Hard.
    await page.getByRole('button', { name: 'New game' }).click();
    await expect(h1(page)).toHaveText('New game');
    await page.getByRole('radio', { name: '3', exact: true }).check();
    await page.getByRole('radio', { name: 'Hard — 6 enemies' }).check();
    await chooseCharacters(page, 3);
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(h1(page)).toHaveText('Turn 1');
    await expect(page.getByText('Hard', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Board, turn 1\./ })).toBeVisible();

    // Question (questions come from the precached bundle).
    await page.getByRole('button', { name: 'Question' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Show the question' }).click();
    const choices = page.getByRole('list', { name: 'Choices' }).getByRole('button');
    await expect(choices.first()).toBeVisible();
    expect(await choices.count()).toBeGreaterThanOrEqual(2);
    await choices.first().click();
    await expect(h1(page)).toHaveText(/(Correct!|Wrong answer)$/);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(h1(page)).toHaveText('Turn 1');

    // End turn is always available (D11: no turn order).
    await page.getByRole('button', { name: 'End turn' }).click();
    await expect(h1(page)).toHaveText('Walls and enemies have moved');
    await page.getByRole('button', { name: 'Start turn 2' }).click();
    await expect(h1(page)).toHaveText('Turn 2');

    // End game (D13).
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'End game' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'End game' }).click();
    await expect(h1(page)).toHaveText(APP_NAME);
    await expect(page.getByRole('button', { name: /^Continue game/ })).toHaveCount(0);

    expect(net.foreign()).toEqual([]);
    expect(net.failed).toEqual([]);
  });

  test('offline: a deep link loads the app (navigateFallback)', async ({
    page,
    context,
    baseURL,
  }) => {
    const net = watchNetwork(context, new URL(baseURL!).origin);
    await page.goto('/');
    await waitForControl(page);

    await context.setOffline(true);
    const response = await page.goto('/anything/else');
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(h1(page)).toHaveText(APP_NAME);
    await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
    expect(net.foreign()).toEqual([]);
    expect(net.failed).toEqual([]);
  });
});
