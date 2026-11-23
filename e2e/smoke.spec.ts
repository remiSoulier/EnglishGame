import { expect, test } from '@playwright/test';
import { APP_NAME, startGame } from './helpers';

test('opens on the home screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(APP_NAME);
  await expect(page.getByRole('heading', { level: 1, name: APP_NAME })).toBeVisible();
});

test('shows the board screen once a game is started', async ({ page }) => {
  await startGame(page);
  await expect(page.getByRole('heading', { level: 1, name: /^Turn \d+$/ })).toBeVisible();
});
