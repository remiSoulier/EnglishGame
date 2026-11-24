import { expect, test, type Locator, type Page } from '@playwright/test';
import { startGame } from './helpers';

const VIEWPORT = { width: 390, height: 844 };
/** Sizes of the pieces W1 … W8 (decision D12), regex-escaped. */
const WALL_SIZES = [
  '88 mm',
  '88 mm',
  '132 mm',
  '176 mm',
  '44 \\+ 44 mm',
  '88 \\+ 44 mm',
  '88 \\+ 88 mm',
  '132 \\+ 88 mm',
];

function grid(page: Page, turn: number) {
  return page.getByRole('img', { name: new RegExp(`^Board, turn ${turn}\\.`) });
}

function toggle(page: Page) {
  return page.getByRole('button', { name: /^(Show|Hide) positions$/ });
}

async function panel(page: Page): Promise<Locator> {
  const id = await toggle(page).getAttribute('aria-controls');
  expect(id).toBeTruthy();
  return page.locator(`[id="${id}"]`);
}

async function endTurn(page: Page) {
  await page.getByRole('button', { name: 'End turn' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Walls and enemies have moved' }),
  ).toBeVisible();
}

const goalOf = (label: string) => /Goal on ([A-I][1-9])\./.exec(label)![1];
const enemiesOf = (label: string) =>
  (/Enem(?:y|ies) on ([^.]+)\./.exec(label)?.[1] ?? '').split(', ').filter(Boolean).sort();
const wallCountOf = (label: string) => Number(/(\d+) walls?\./.exec(label)![1]);

/** Reads the panel as { term → value text } plus the wall lines. */
async function readPanel(root: Locator) {
  return root.evaluate((el) => {
    const map: Record<string, string> = {};
    for (const dt of el.querySelectorAll('dt')) {
      map[dt.textContent!.trim()] = dt.nextElementSibling!.textContent!.trim();
    }
    const walls = [...el.querySelectorAll('dd li')].map((li) => li.textContent!.trim());
    return { map, walls };
  });
}

async function expectPanelMatchesGrid(page: Page, turn: number) {
  const label = (await grid(page, turn).getAttribute('aria-label'))!;
  const root = await panel(page);
  await expect(root).toBeVisible();
  const { map, walls } = await readPanel(root);
  expect(map['Goal:']).toBe(goalOf(label));
  const enemies = enemiesOf(label);
  const term = enemies.length === 1 ? 'Enemy:' : 'Enemies:';
  expect(map[term].split(', ').sort()).toEqual(enemies);
  expect(walls).toHaveLength(wallCountOf(label));
  expect(walls).toHaveLength(8);
  walls.forEach((w, i) =>
    expect(w).toMatch(
      new RegExp(`^W${i + 1} \\(${WALL_SIZES[i]}\\): [A-I][1-9]-[ES](, [A-I][1-9]-[ES])+$`),
    ),
  );
  expect(map['Start:']).toBe('P1 A1, P2 I9, P3 I1, P4 A9');
  await expect(root.getByText('E = east side, S = south side of the cell.')).toBeVisible();
  return { label, map, walls };
}

const CONTRAST_SCRIPT = String.raw`((root) => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    while (el) {
      const c = parse(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0.5) return c;
      el = el.parentElement;
    }
    return { r: 255, g: 255, b: 255 };
  };
  const els = [...root.querySelectorAll('*')].filter((el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
  );
  return els.map((el) => {
    const l1 = lum(parse(getComputedStyle(el).color));
    const l2 = lum(bgOf(el));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { text: el.textContent.trim().slice(0, 40), ratio };
  });
})`;

test.beforeEach(async ({ page }) => {
  await startGame(page, { players: 4, difficulty: 'Hard', code: 'K7QP2MX' });
});

test('collapsed by default, opens and closes', async ({ page }) => {
  await expect(toggle(page)).toHaveText(/Show positions$/);
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  const root = await panel(page);
  await expect(root).toBeHidden();

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle(page)).toHaveText(/Hide positions$/);
  await expect(root).toBeVisible();

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(root).toBeHidden();
});

test('open panel: content equals the grid, 44 px button, no horizontal scroll, contrast', async ({
  page,
}) => {
  await toggle(page).click();
  await expectPanelMatchesGrid(page, 1);

  const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
  expect(scrollWidth).toBeLessThanOrEqual(VIEWPORT.width);

  const box = await toggle(page).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORT.width);

  const id = (await toggle(page).getAttribute('aria-controls'))!;
  const ratios = await page.evaluate<{ text: string; ratio: number }[]>(
    `(${CONTRAST_SCRIPT})(document.getElementById(${JSON.stringify(id)}).parentElement)`,
  );
  expect(ratios.length).toBeGreaterThan(5);
  for (const { text, ratio } of ratios) {
    expect(ratio, `contrast of "${text}"`).toBeGreaterThanOrEqual(4.5);
  }
});

test('on the New board screen and updated after End turn (same goal)', async ({ page }) => {
  await toggle(page).click();
  const before = await expectPanelMatchesGrid(page, 1);

  await endTurn(page);
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  await toggle(page).click();
  const onNewBoard = await expectPanelMatchesGrid(page, 2);
  expect(onNewBoard.map['Goal:']).toBe(before.map['Goal:']);
  expect(onNewBoard.walls).not.toEqual(before.walls);

  await page.getByRole('button', { name: 'Start turn 2' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Turn 2' })).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  await toggle(page).click();
  const turn2 = await expectPanelMatchesGrid(page, 2);
  expect(turn2.map).toEqual(onNewBoard.map);
  expect(turn2.walls).toEqual(onNewBoard.walls);
});
