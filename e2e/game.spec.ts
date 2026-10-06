import { devices, expect, test } from '@playwright/test';
import { DIFFICULTY_NAMES, SCENARIO_LIST } from '../packages/shared/src/scenarios';
import type { Scenario } from '../packages/shared/src/types';
import {
  bothReady,
  deviceOptions,
  playOneDie,
  playToTheEnd,
  setGame,
  startGame,
  takeOff,
} from './helpers';

test.describe('a two-player game', () => {
  test('plays the base scenario to a crash, then flies again', async ({ browser }, testInfo) => {
    // The longest test: a whole game through the UI (slow on WebKit when run in parallel).
    test.setTimeout(180_000);
    const players = await startGame(browser, deviceOptions(testInfo.project.use));
    await bothReady(players);
    await playToTheEnd(players);

    for (const page of [players.pilot, players.copilot]) {
      const dialog = page.getByRole('dialog', { name: 'Crashed' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('listitem').first()).toBeVisible();
    }

    await players.copilot.getByRole('button', { name: 'Fly again' }).click();
    for (const page of [players.pilot, players.copilot]) {
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.getByText(/Round 1\/7/)).toBeVisible();
      // A new game starts with the crew choosing seats and abilities again.
      await expect(page.getByRole('region', { name: 'Before take-off' })).toBeVisible();
    }
  });

  test('lands the plane from a ready final round', async ({ browser, request }, testInfo) => {
    const players = await startGame(browser, deviceOptions(testInfo.project.use));
    const { pilot, copilot, code } = players;
    await bothReady(players);

    // Everything deployed and the approach clear; only the final dice are left to play.
    const dice = (seat: 'p' | 'c', values: number[]) =>
      values.map((value, i) => ({ id: `r7-${seat}${i + 1}`, value }));
    await setGame(request, code, {
      phase: 'placing',
      round: 7,
      currentSeat: 'pilot',
      approachIndex: 6,
      approachPlanes: [0, 0, 0, 0, 0, 0, 0],
      gear: [true, true, true],
      flaps: [true, true, true, true],
      aeroBlue: 7,
      aeroOrange: 12,
      brakes: 3,
      placed: {},
      speed: null,
      dice: { pilot: dice('p', [4, 2, 5, 6]), copilot: dice('c', [4, 3, 5, 6]) },
    });
    await expect(pilot.getByText('Final', { exact: true })).toBeVisible();

    const place = async (page: typeof pilot, value: number, slot: string) => {
      await page.getByRole('button', { name: `Your die: ${value}` }).click();
      await page.getByRole('button', { name: slot }).click();
    };
    await place(pilot, 4, 'Axis 1 (pilot)');
    await place(copilot, 4, 'Axis 2 (co-pilot)');
    await place(pilot, 2, 'Engines 1 (pilot)');
    // Speed 5, brakes stop up to 6: every condition is met, so the game ends right away,
    // with dice still in hand.
    await place(copilot, 3, 'Engines 2 (co-pilot)');

    for (const page of [pilot, copilot]) {
      await expect(page.getByRole('dialog', { name: 'Smooth landing!' })).toBeVisible();
    }
  });

  test('refreshing either tab mid-round resumes exactly', async ({ browser }, testInfo) => {
    const players = await startGame(browser, deviceOptions(testInfo.project.use));
    const { pilot, copilot } = players;
    await bothReady(players);
    await playOneDie(pilot);
    await expect(copilot.getByText(/^Your turn: /)).toBeVisible();
    await playOneDie(copilot);
    await expect(pilot.getByText(/^Your turn: /)).toBeVisible();

    for (const page of [pilot, copilot]) {
      const snapshot = () =>
        page.evaluate(() => ({
          dice: [...document.querySelectorAll('button[aria-label^="Your die"]')].map((b) =>
            b.getAttribute('aria-label'),
          ),
          placed: [...document.querySelectorAll('button[aria-label*="):"]')].map((b) =>
            b.getAttribute('aria-label'),
          ),
          status: document.querySelector('header [role="status"]')?.textContent,
        }));
      const before = await snapshot();
      await page.reload();
      await expect(page.getByRole('button', { name: /^Your die/ }).first()).toBeVisible();
      await expect.poll(snapshot).toEqual(before);
    }
  });

  test('a player who leaves frees the seat for someone new', async ({ browser }, testInfo) => {
    const device = deviceOptions(testInfo.project.use);
    const { pilot, copilot, code } = await startGame(browser, device);

    await copilot.getByRole('button', { name: 'Leave game' }).click();
    await copilot.getByRole('dialog').getByRole('button', { name: 'Leave game' }).click();
    await expect(copilot.getByRole('button', { name: 'Create a game' })).toBeVisible();
    await expect(pilot.getByText(/Ben left the game/)).toBeVisible();
    await expect(pilot.getByText('Waiting for your co-pilot')).toBeVisible();

    const newcomer = await (await browser.newContext(device)).newPage();
    await newcomer.goto(`/r/${code}`);
    await newcomer.getByLabel('Your name').fill('Cat');
    await newcomer.getByRole('button', { name: 'Join' }).click();
    await expect(pilot.getByText(/Cat joined the game/)).toBeVisible();
    await expect(newcomer.getByRole('region', { name: 'Before take-off' })).toBeVisible();
  });
});

test.describe('mixed devices', () => {
  test('a desktop pilot and a phone co-pilot play a round', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'one desktop + phone game is enough');
    const players = await startGame(
      browser,
      deviceOptions(testInfo.project.use),
      deviceOptions({ ...devices['Pixel 7'], baseURL: testInfo.project.use.baseURL }),
    );
    await bothReady(players);
    for (let i = 0; i < 8; i++) {
      const page = (await players.pilot.getByText(/^Your turn: /).isVisible())
        ? players.pilot
        : players.copilot;
      await expect(page.getByText(/^Your turn: /)).toBeVisible();
      await playOneDie(page);
      if (await players.pilot.getByRole('dialog').isVisible()) break;
    }
    // Either the round ended (next strategy phase) or the plane went down: both agree.
    await expect(players.copilot.getByText(/Round 2\/7|Crashed/).first()).toBeVisible();
  });
});

test.describe('round timer', () => {
  test('a timed game counts down each round and is lost when time runs out', async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'one browser is enough');
    const device = deviceOptions(testInfo.project.use);
    const pilot = await (await browser.newContext(device)).newPage();
    const copilot = await (await browser.newContext(device)).newPage();

    await pilot.goto('/');
    await pilot.getByLabel('Your name').fill('Ana');
    await pilot.getByRole('switch', { name: /Round timer/ }).click();
    await pilot.getByRole('button', { name: 'Create a game' }).click();
    await expect(pilot.getByText(/Timed game: 0:05 per round/)).toBeVisible();
    const code = (await pilot.getByLabel(/^Game code/).textContent())!.trim();

    await copilot.goto(`/r/${code}`);
    await copilot.getByLabel('Your name').fill('Ben');
    await copilot.getByRole('button', { name: 'Join' }).click();
    await takeOff({ pilot, copilot });
    await expect(copilot.getByText(/Timed game: 0:05 to place all the dice/)).toBeVisible();
    await expect(copilot.getByRole('timer')).toHaveCount(0); // not before the roll

    await bothReady({ pilot, copilot, code });
    for (const page of [pilot, copilot]) {
      await expect(page.getByRole('timer')).toBeVisible();
    }

    // Nobody places a die: both lose when the 5 seconds are up.
    for (const page of [pilot, copilot]) {
      await expect(page.getByText('Time ran out before all the dice were placed.')).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});

/** The first active scenario that matches (scenarios.ts decides which exist). */
function pick(match: (s: Scenario) => boolean): Scenario {
  const found = SCENARIO_LIST.find(match);
  if (!found) throw new Error('no active scenario matches this test');
  return found;
}

/** The scenario's option in the lobby list: "LHR Heathrow, Exceptional conditions". */
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const option = (s: Scenario) =>
  new RegExp(`^${escape(s.name)}\\s*,\\s*${escape(DIFFICULTY_NAMES[s.difficulty])}`);

test.describe('Flight Log scenarios', () => {
  test('burns kerosene with a die on the Kerosene space', async ({ browser }, testInfo) => {
    const device = deviceOptions(testInfo.project.use);
    // Kerosene without Real-time, so the 60-second rounds cannot interfere.
    const scenario = pick(
      (s) => s.modules.includes('kerosene') && !s.modules.includes('real-time'),
    );
    const players = await startGame(browser, device, device, option(scenario));
    await expect(players.copilot.getByText(scenario.name).first()).toBeVisible();
    await bothReady(players);
    const { pilot, copilot } = players;
    const die = pilot.getByRole('button', { name: /^Your die/ }).first();
    const value = Number((await die.getAttribute('aria-label'))!.replace(/\D/g, ''));
    await die.click();
    await pilot.getByRole('button', { name: 'Kerosene 1 (either player)' }).click();
    for (const page of [pilot, copilot]) {
      await expect(page.getByRole('meter', { name: 'Kerosene' })).toHaveAttribute(
        'aria-valuenow',
        String(20 - value),
      );
    }
  });

  test('trains the intern: a die on the Intern space, then its token on the board', async ({
    browser,
  }, testInfo) => {
    const device = deviceOptions(testInfo.project.use);
    const scenario = pick((s) => s.modules.includes('intern') && !s.modules.includes('real-time'));
    const players = await startGame(browser, device, device, option(scenario));
    await bothReady(players);
    const { pilot, copilot } = players;
    // Traffic icons on the first space: the die rolled before the game started.
    const icons = scenario.traffic?.[0] ?? 0;
    if (icons > 0) {
      await expect(
        pilot.getByRole('img', {
          name: new RegExp(`Current space: traffic die ${icons}× each round here`),
        }),
      ).toBeVisible();
    }

    const dice = pilot.getByRole('button', { name: /^Your die/ });
    const intern = pilot.getByRole('button', { name: 'Intern 1 (pilot)' });
    for (let i = 0; i < (await dice.count()); i++) {
      await dice.nth(i).click();
      if (await intern.isEnabled()) break;
      await dice.nth(i).click();
    }
    await intern.click();
    await expect(pilot.getByText(/Intern token \d: tap a glowing space for it/)).toBeVisible();
    await pilot.locator('button[data-valid]').first().click();
    for (const page of [pilot, copilot]) {
      await expect(page.getByLabel(/^Intern tokens left: \d(, \d){4}$/)).toBeAttached();
    }
    await expect(copilot.getByText(/^Your turn: /)).toBeVisible();
  });
});
