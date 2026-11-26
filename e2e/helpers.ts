import { expect, type Page } from '@playwright/test';
import { generateBoard } from '../src/engine';

/** App name (mirrors src/state/appInfo.ts and the index.html <title>). */
export const APP_NAME = 'SILVA';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** localStorage key of the saved game (mirrors src/state/storage.ts). */
export const STORAGE_KEY = 'bgc.game.v2';

/** Difficulty line under the board title: no board code any more (decision D22). */
export const DIFFICULTY_LINE = /^(Easy|Medium|Hard)$/;

export const DIFFICULTY_RADIO: Readonly<Record<Difficulty, string>> = {
  Easy: 'Easy — 2 enemies',
  Medium: 'Medium — 4 enemies',
  Hard: 'Hard — 6 enemies',
};

export interface StartGameOptions {
  players?: 2 | 3 | 4;
  difficulty?: Difficulty;
  /**
   * Board code of the game, for a known board. The app no longer lets players type a code
   * (decision D22): the game is started through the UI, then its saved board is replaced by the
   * engine's board for this code and the page is reloaded.
   */
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
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
  if (code !== undefined) await loadBoardCode(page, code);
}

/** Code of the saved game: it is not shown on screen any more (decision D22). */
export async function savedCode(page: Page): Promise<string> {
  const saved = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return (JSON.parse(saved ?? 'null') as { state: { game: { code: string } } }).state.game.code;
}

/** Replaces the turn-1 game on screen by the board of `code` (engine), then reloads. */
async function loadBoardCode(page: Page, code: string): Promise<void> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  const saved = JSON.parse(raw!) as {
    state: { game: { code: string; difficulty: 'easy' | 'medium' | 'hard'; board: unknown } };
  };
  const { game } = saved.state;
  const board = generateBoard(code, 1, game.difficulty);
  game.code = board.code;
  game.board = board;
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [
    STORAGE_KEY,
    JSON.stringify(saved),
  ] as const);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 1' })).toBeVisible();
}

/**
 * Waits until the question card has finished flipping over (decision D18): measure layout only
 * once every CSS animation on the page is done.
 */
export async function waitForCardFlip(page: Page): Promise<void> {
  await page.waitForFunction(
    "document.getAnimations().every((a) => a.playState === 'finished' || a.playState === 'idle')",
  );
}

/**
 * What identifies the game on the board screen: `<code> · <difficulty>`. The code comes from the
 * save (decision D22: it is no longer shown), the difficulty from the line under the title.
 */
export async function gameLine(page: Page): Promise<string> {
  await expect(page.getByText(/^Code /)).toHaveCount(0);
  const difficulty = await page.getByText(DIFFICULTY_LINE).textContent();
  return `${await savedCode(page)} · ${difficulty}`;
}
