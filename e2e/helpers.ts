import { expect, type Page } from '@playwright/test';

/** App name (mirrors src/state/appInfo.ts and the index.html <title>). */
export const APP_NAME = 'SILVA';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export const DIFFICULTY_RADIO: Readonly<Record<Difficulty, string>> = {
  Easy: 'Easy — 2 enemies',
  Medium: 'Medium — 4 enemies',
  Hard: 'Hard — 6 enemies',
};

export interface StartGameOptions {
  players?: 2 | 3 | 4;
  difficulty?: Difficulty;
  /** Board code to type; a random board is used when omitted. */
  code?: string;
  /** Navigate to `/` first (default true). */
  goto?: boolean;
}

/** Opens the new game screen from the home screen. */
export async function openNewGame(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'New game' })).toBeVisible();
}

/** Home → New game → players / difficulty / board → Start game, then waits for turn 1. */
export async function startGame(
  page: Page,
  { players = 4, difficulty = 'Medium', code, goto = true }: StartGameOptions = {},
): Promise<void> {
  if (goto) await page.goto('/');
  // A saved "new game" screen (no game yet) is restored as is on reload.
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(new RegExp(`^(${APP_NAME}|New game)$`));
  if ((await heading.textContent()) !== 'New game') await openNewGame(page);
  await page.getByRole('radio', { name: String(players), exact: true }).check();
  await page.getByRole('radio', { name: DIFFICULTY_RADIO[difficulty] }).check();
  if (code !== undefined) {
    await page.getByRole('radio', { name: 'Enter a board code' }).check();
    await page.getByRole('textbox', { name: 'Board code' }).fill(code);
  }
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
}
