import { expect, test } from '@playwright/test';
import { bothReady, deviceOptions, setGame, startGame } from './helpers';

test('a finished game goes into the Flight Log once, and its scenario gets a ✓', async ({
  browser,
  request,
}, testInfo) => {
  const players = await startGame(browser, deviceOptions(testInfo.project.use));
  const { pilot, code } = players;
  await bothReady(players);

  // The landing succeeds: the game ends while both players watch.
  await setGame(request, code, { phase: 'won' });
  await expect(pilot.getByRole('heading', { name: 'Smooth landing!' })).toBeVisible();

  const pilotCell = async () => {
    await pilot.getByRole('button', { name: 'Flight Log' }).click();
    const row = pilot.getByRole('row', { name: /^Routine landing YUL/ });
    const cell = row.getByRole('cell', { name: /^Pilot: / });
    const text = await cell.getAttribute('aria-label');
    await pilot.keyboard.press('Escape');
    return text;
  };
  expect(await pilotCell()).toBe('Pilot: 1 won, 0 lost');

  // The result screen comes back after a reload; the game is not counted twice.
  await pilot.reload();
  await expect(pilot.getByRole('heading', { name: 'Smooth landing!' })).toBeVisible();
  expect(await pilotCell()).toBe('Pilot: 1 won, 0 lost');

  // Back in the lobby, the landed scenario has a ✓ in the picker.
  await pilot.getByRole('button', { name: 'Leave' }).click();
  await pilot.getByRole('combobox', { name: 'Scenario' }).click();
  await expect(
    pilot.getByRole('option', { name: /^YUL.*, Routine landing/ }).getByRole('img', {
      name: 'landed',
    }),
  ).toBeVisible();
});
