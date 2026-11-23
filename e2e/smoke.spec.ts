import { expect, test } from '@playwright/test';

test('shows the app title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Board Game Companion' })).toBeVisible();
});
