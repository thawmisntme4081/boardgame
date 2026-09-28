import { devices, expect, test } from '@playwright/test';
import { bothReady, deviceOptions, playOneDie, playToTheEnd, setGame, startGame } from './helpers';

test.describe('a two-player game', () => {
  test('plays the base scenario to a crash, then flies again', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const players = await startGame(browser, deviceOptions(testInfo.project.use));
    await bothReady(players);
    await playToTheEnd(players);

    for (const page of [players.pilot, players.copilot]) {
      const dialog = page.getByRole('dialog', { name: 'The plane went down' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('listitem').first()).toBeVisible();
    }

    await players.copilot.getByRole('button', { name: 'Fly again' }).click();
    for (const page of [players.pilot, players.copilot]) {
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.getByText(/Round 1\/7/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ready to roll' })).toBeVisible();
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
    await place(copilot, 4, 'Axis 2 (copilot)');
    await place(pilot, 2, 'Engines 1 (pilot)');
    await place(copilot, 3, 'Engines 2 (copilot)'); // speed 5, brakes stop up to 6
    await place(pilot, 5, 'Concentration 1 (either player)');
    await place(copilot, 5, 'Concentration 2 (either player)');
    await place(pilot, 6, 'Concentration 3 (either player)');
    await place(copilot, 6, 'Radio 2 (copilot)');

    for (const page of [pilot, copilot]) {
      await expect(page.getByRole('dialog', { name: 'Smooth landing!' })).toBeVisible();
    }
  });

  test('refreshing either tab mid-round resumes exactly', async ({ browser }, testInfo) => {
    const players = await startGame(browser, deviceOptions(testInfo.project.use));
    const { pilot, copilot } = players;
    await bothReady(players);
    await playOneDie(pilot);
    await expect(copilot.getByText('Your turn: tap a die')).toBeVisible();
    await playOneDie(copilot);
    await expect(pilot.getByText('Your turn: tap a die')).toBeVisible();

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
    await expect(newcomer.getByRole('button', { name: 'Ready to roll' })).toBeVisible();
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
      const page = (await players.pilot.getByText('Your turn: tap a die').isVisible())
        ? players.pilot
        : players.copilot;
      await expect(page.getByText('Your turn: tap a die')).toBeVisible();
      await playOneDie(page);
      if (await players.pilot.getByRole('dialog').isVisible()) break;
    }
    // Either the round ended (next strategy phase) or the plane went down: both agree.
    await expect(players.copilot.getByText(/Round 2\/7|The plane went down/).first()).toBeVisible();
  });
});
