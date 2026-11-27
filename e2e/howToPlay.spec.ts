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
  expect(scrollWidth, `${label}: no horizontal scroll`).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 390,
  );
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

/** D34: the step 2 cards are whole, side by side, and inside the screen (390 and 320 px wide). */
const CARD_BOXES = `Array.from(document.querySelectorAll('img[alt^="Card:"]')).map((img) => {
  const r = img.getBoundingClientRect();
  return { left: r.left, right: r.right, natural: img.naturalWidth, height: img.naturalHeight };
})`;

for (const width of [390, 320]) {
  test(`step 2: the three cards are whole and none covers another (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await openHowToPlay(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 2 of 6')).toBeVisible();
    for (const alt of ['Card: Move forward(1)', 'Card: Turn left(90)', 'Card: Repeat(2)']) {
      await expect(page.getByRole('img', { name: alt })).toBeVisible();
    }
    await expect
      .poll(async () => (await page.evaluate<{ natural: number }[]>(CARD_BOXES))[2].natural)
      .toBe(240);
    const cards =
      await page.evaluate<{ left: number; right: number; natural: number; height: number }[]>(
        CARD_BOXES,
      );
    // The art is the card itself: no see-through strip on its side.
    expect(cards.map((c) => [c.natural, c.height])).toEqual([
      [240, 337],
      [240, 337],
      [240, 337],
    ]);
    // Left to right, a gap between two cards (tilted from their bottom edge), inside the screen.
    expect(cards[0].right).toBeLessThan(cards[1].left);
    expect(cards[1].right).toBeLessThan(cards[2].left);
    expect(cards[0].left).toBeGreaterThanOrEqual(8);
    expect(cards[2].right).toBeLessThanOrEqual(width - 8);
    await expectNoHorizontalScroll(page, `step 2 at ${width} px`);
  });
}
