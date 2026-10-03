import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from '@playwright/test';

/** Device settings from the running project (or another device), for a second player. */
export function deviceOptions(use: TestInfo['project']['use']): BrowserContextOptions {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = use;
  return { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL };
}

export interface Players {
  pilot: Page;
  copilot: Page;
  code: string;
}

/**
 * Ana creates a game (on `scenario`, an option name in the lobby's scenario list, if
 * given), Ben joins through the invite link; both reach the game screen.
 */
export async function startGame(
  browser: Browser,
  pilotDevice: BrowserContextOptions,
  copilotDevice: BrowserContextOptions = pilotDevice,
  scenario?: RegExp,
): Promise<Players> {
  const pilot = await (await browser.newContext(pilotDevice)).newPage();
  const copilot = await (await browser.newContext(copilotDevice)).newPage();

  await pilot.goto('/');
  await pilot.getByLabel('Your name').fill('Ana');
  if (scenario) {
    await pilot.getByRole('combobox', { name: 'Scenario' }).click();
    await pilot.getByRole('option', { name: scenario }).click();
  }
  await pilot.getByRole('button', { name: 'Create a game' }).click();
  await expect(pilot.getByText('Waiting for your co-pilot')).toBeVisible();
  const code = (await pilot.getByLabel(/^Game code/).textContent())!.trim();

  await copilot.goto(`/r/${code}`);
  await expect(copilot.getByLabel('Game code')).toHaveValue(code);
  await copilot.getByLabel('Your name').fill('Ben');
  await copilot.getByRole('button', { name: 'Join' }).click();

  await takeOff({ pilot, copilot });
  return { pilot, copilot, code };
}

/**
 * Before round 1: the creator (Ana) keeps the pilot seat, the Special Ability cards are
 * picked, and both confirm; round 1 starts and "Roll dice" appears.
 */
export async function takeOff({ pilot, copilot }: Pick<Players, 'pilot' | 'copilot'>) {
  const panel = (page: Page) => page.getByRole('region', { name: 'Before take-off' });
  await panel(pilot).getByRole('button', { name: 'Pilot', exact: true }).click();
  await expect(
    panel(copilot).getByRole('button', { name: 'Co-pilot', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await chooseAbilities({ pilot, copilot });
  for (const page of [pilot, copilot]) {
    await panel(page).getByRole('button', { name: 'Confirm' }).click();
  }
  for (const page of [pilot, copilot]) {
    await expect(page.getByRole('button', { name: 'Roll dice' })).toBeVisible();
  }
}

/**
 * Before round 1: each player who may pick a Special Ability card takes one (the pilot the
 * first free card, the co-pilot the last, so they never clash).
 */
export async function chooseAbilities({ pilot, copilot }: Pick<Players, 'pilot' | 'copilot'>) {
  for (const [page, end] of [
    [pilot, 'first'],
    [copilot, 'last'],
  ] as const) {
    const cards = page.getByRole('region', { name: 'Before take-off' }).locator('fieldset button');
    const free = cards.and(page.locator(':not([disabled])'));
    if ((await free.count()) === 0) continue;
    await free[end]().click();
    await expect(cards.and(page.locator('[aria-pressed="true"]'))).toHaveCount(1);
  }
}

export async function bothReady({ pilot, copilot }: Players): Promise<void> {
  await pilot.getByRole('button', { name: 'Roll dice' }).click();
  await copilot.getByRole('button', { name: 'Roll dice' }).click();
  await expect(pilot.getByText(/Your turn|’s turn/).first()).toBeVisible();
}

const yourTurn = (page: Page) => page.getByText('Your turn: tap a die').isVisible();

/**
 * Plays one die the way a careful beginner would: the first die that fits a lit axis or
 * engine space, otherwise the first lit space at all. Deterministic for fixed dice.
 */
export async function playOneDie(page: Page): Promise<void> {
  const dice = page.getByRole('button', { name: /^Your die/ });
  const count = await dice.count();
  for (const prefer of [/^(Axis|Engines)/, /./]) {
    for (let i = 0; i < count; i++) {
      await dice.nth(i).click();
      const lit = page.locator('button[data-valid]');
      for (let k = 0; k < (await lit.count()); k++) {
        if (prefer.test((await lit.nth(k).getAttribute('aria-label')) ?? '')) {
          await lit.nth(k).click();
          // Wait for the server's new view (the die leaves the tray; a round or game end
          // empties it), so a stale "Your turn" is never acted on twice.
          await expect.poll(() => dice.count()).toBeLessThan(count);
          return;
        }
      }
      await dice.nth(i).click(); // unselect and try the next die
    }
  }
  throw new Error('no legal move lit up for any die');
}

/** Plays rounds (ready, then dice) until the game-over dialog shows for both. */
export async function playToTheEnd(players: Players): Promise<void> {
  const { pilot, copilot } = players;
  for (let step = 0; step < 200; step++) {
    if (await pilot.getByRole('dialog').isVisible()) break;
    if (await pilot.getByRole('button', { name: 'Roll dice' }).isVisible()) {
      await bothReady(players);
      continue;
    }
    const page = (await yourTurn(pilot)) ? pilot : (await yourTurn(copilot)) ? copilot : null;
    if (page) await playOneDie(page);
    else await pilot.waitForTimeout(100);
  }
  await expect(pilot.getByRole('dialog')).toBeVisible();
  await expect(copilot.getByRole('dialog')).toBeVisible();
}

/** Test-only route: merges a partial game state into the room and rebroadcasts views. */
export async function setGame(
  request: APIRequestContext,
  code: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await request.post(`/__e2e/rooms/${code}/game`, { data: patch });
  expect(res.ok()).toBe(true);
}
