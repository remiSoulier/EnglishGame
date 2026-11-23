import { expect, test, type Page } from '@playwright/test';

const VIEWPORT = { width: 390, height: 844 };

function grid(page: Page, turn: number) {
  return page.getByRole('img', { name: new RegExp(`^Board, turn ${turn}\\.`) });
}

async function endTurn(page: Page) {
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next player' }).click();
  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Walls and enemies have moved' }),
  ).toBeVisible();
}

const goalOf = (label: string) => /Goal on ([A-I][1-9])\./.exec(label)![1];
const enemiesOf = (label: string) => /Enem(?:y|ies) on ([^.]+)\./.exec(label)?.[1];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('two full turns: goal and code stay, enemies move', async ({ page }) => {
  const codeLine = page.getByText(/^Code \S+ · Medium$/);
  const code = await codeLine.textContent();
  const label1 = (await grid(page, 1).getAttribute('aria-label'))!;
  const goal = goalOf(label1);

  let previous = label1;
  for (const turn of [2, 3]) {
    await endTurn(page);
    await expect(page.getByText(`The goal stays on ${goal}`)).toBeVisible();
    const label = (await grid(page, turn).getAttribute('aria-label'))!;
    expect(goalOf(label)).toBe(goal);
    expect(enemiesOf(label)).not.toBe(enemiesOf(previous));

    await page.getByRole('button', { name: `Start turn ${turn}` }).click();
    await expect(page.getByRole('heading', { level: 1, name: `Turn ${turn}` })).toBeVisible();
    await expect(codeLine).toHaveText(code!);
    await expect(grid(page, turn)).toHaveAttribute('aria-label', label);
    await expect(
      page.getByRole('list', { name: 'Players' }).getByRole('listitem').first(),
    ).toHaveAttribute('aria-current', 'true');
    previous = label;
  }
});

test('new board screen: content, 44 px button, no horizontal scroll at 390 px', async ({
  page,
}) => {
  await endTurn(page);
  await expect(page.getByText('Copy the new walls and enemies onto your board.')).toBeVisible();
  await expect(grid(page, 2)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Legend' })).toBeVisible();
  await expect(page.getByText(/^The goal stays on [A-I][1-9]$/)).toBeVisible();

  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width);

  const button = page.getByRole('button', { name: 'Start turn 2' });
  await expect(button).toBeVisible();
  await expect(button).toBeInViewport({ ratio: 1 });
  const box = (await button.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(VIEWPORT.width);
  expect(box.y + box.height).toBeLessThanOrEqual(VIEWPORT.height);
  expect(await page.locator('button').count()).toBe(1);
});
