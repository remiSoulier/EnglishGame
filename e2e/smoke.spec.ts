import { expect, test } from '@playwright/test';

test('shows the board screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Board Game Companion');
  await expect(page.getByRole('heading', { level: 1, name: /^Turn \d+$/ })).toBeVisible();
});
