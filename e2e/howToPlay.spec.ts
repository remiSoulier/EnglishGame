import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from './helpers';

/**
 * D28 — How to play at 390 × 844: Home → the 6 steps → Start a game; Skip and ‹ go back to
 * Home; arrows move between steps; no horizontal scroll.
 */

const TITLES = [
  'Set up the board',
  'Program your pawn',
  'Out of cards? Answer!',
  'Watch out',
  'End of the turn',
  'Reach the dragon',
];

test.use({ viewport: { width: 390, height: 844 } });

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });
const h2 = (page: Page) => page.getByRole('heading', { level: 2 });

async function openHowToPlay(page: Page) {
  await page.goto('/');
  await expect(h1(page)).toHaveText(APP_NAME);
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(h1(page)).toHaveText('How to play');
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth, `${label}: no horizontal scroll`).toBeLessThanOrEqual(390);
}

test('Home → the 6 steps → Start a game opens New game', async ({ page }) => {
  await openHowToPlay(page);
  const back = page.getByRole('button', { name: 'Back', exact: true });
  const next = page.getByRole('button', { name: 'Next' });

  for (const [i, title] of TITLES.entries()) {
    await expect(page.getByText(`Step ${i + 1} of 6`)).toBeVisible();
    await expect(h2(page)).toHaveText(title);
    // Opening focuses the screen title; each new step focuses its h2 so it is announced.
    await expect(i === 0 ? h1(page) : h2(page)).toBeFocused();
    if (i === 0) await expect(back).toBeDisabled();
    else await expect(back).toBeEnabled();
    await expectNoHorizontalScroll(page, `step ${i + 1}`);
    if (i === 1) {
      for (const alt of ['Card: Move forward(1)', 'Card: Turn left(90)', 'Card: Repeat(2)']) {
        await expect(page.getByRole('img', { name: alt })).toBeVisible();
      }
    }
    if (i < TITLES.length - 1) await next.click();
  }

  await expect(next).toHaveCount(0);
  await page.getByRole('button', { name: 'Start a game' }).click();
  await expect(h1(page)).toHaveText('New game');
});

test('Back goes to the previous step; the arrow keys move between steps', async ({ page }) => {
  await openHowToPlay(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(h2(page)).toHaveText(TITLES[1]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(h2(page)).toHaveText(TITLES[0]);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(h2(page)).toHaveText(TITLES[2]);
  await page.keyboard.press('ArrowLeft');
  await expect(h2(page)).toHaveText(TITLES[1]);
});

test('Skip, ‹ and the system back return to Home', async ({ page }) => {
  await openHowToPlay(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(h1(page)).toHaveText(APP_NAME);
  await expect(page.getByRole('button', { name: 'How to play' })).toBeFocused();

  // Reopening starts again at step 1.
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(h2(page)).toHaveText(TITLES[0]);
  await page.getByRole('button', { name: 'Back to home' }).click();
  await expect(h1(page)).toHaveText(APP_NAME);

  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(h1(page)).toHaveText('How to play');
  await page.goBack();
  await expect(h1(page)).toHaveText(APP_NAME);
});
