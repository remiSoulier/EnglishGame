import { expect, test } from '@playwright/test';
import { APP_NAME } from './helpers';

/** Task #28 / decision D14: the app is named SILVA everywhere a user or the OS sees it. */

const FOREST = '#0f3d3a';

test('Home shows the SILVA name and tagline; the page title is SILVA', async ({ page }) => {
  expect(APP_NAME).toBe('SILVA');
  await page.goto('/');
  await expect(page).toHaveTitle('SILVA');
  await expect(page.getByRole('heading', { level: 1, name: 'SILVA' })).toBeVisible();
  await expect(page.getByText('Program your way to the goal', { exact: true })).toBeVisible();
  await expect(page.getByText(/Board Game Companion|BG Companion/)).toHaveCount(0);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /SILVA/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', FOREST);
});

test('manifest: SILVA name, forest theme and background, same PNG icons', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json();
  expect(manifest.name).toBe('SILVA');
  expect(manifest.short_name).toBe('SILVA');
  expect(manifest.theme_color).toBe(FOREST);
  expect(manifest.background_color).toBe(FOREST);
  expect(manifest.description).toMatch(/SILVA/);
  expect(
    (manifest.icons as { sizes: string; type: string }[]).map((i) => `${i.sizes} ${i.type}`),
  ).toEqual(['192x192 image/png', '512x512 image/png', '512x512 image/png']);
});

test('favicon is served as SVG', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(href).toBe('/favicon.svg');
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^image\/svg\+xml/);
  expect(await res.text()).toContain('<svg');
});
