import { expect, test } from '@playwright/test';
import { YUL } from '../games/sky-team/rules/src/scenarios';
import { bothReady, deviceOptions, setGame, startGame } from './helpers';

test('an alarm blocks the flaps until the pilot clears it with a blue 4', async ({
  browser,
  request,
}, testInfo) => {
  const players = await startGame(browser, deviceOptions(testInfo.project.use));
  const { pilot, copilot, code } = players;
  await bothReady(players);

  // The Flaps alarm is sounding; the pilot (first this round) holds a 4.
  const dice = (seat: 'p' | 'c', values: number[]) =>
    values.map((value, i) => ({ id: `r1-${seat}${i + 1}`, value }));
  await setGame(request, code, {
    scenario: { ...YUL, modules: ['alarms'] },
    alarms: {
      active: ['flaps'],
      faceDown: ['concentration', 'brakes', 'gear', 'radioPilot', 'radioCopilot'],
    },
    currentSeat: 'pilot',
    placed: {},
    dice: { pilot: dice('p', [4, 2, 3, 3]), copilot: dice('c', [1, 2, 3, 3]) },
  });

  const flaps = copilot.getByRole('button', { name: /^Flaps 1 .*blocked by the Flaps alarm$/ });
  await expect(flaps).toBeDisabled();

  await expect(pilot.getByRole('button', { name: 'Your die: 3' })).toHaveCount(2);
  await pilot.getByRole('button', { name: 'Your die: 4' }).click();
  await pilot.getByRole('button', { name: 'Flaps alarm (pilot, needs 4)' }).click();
  await expect(copilot.getByRole('img', { name: 'Flaps alarm: cleared' })).toBeVisible();
  await expect(
    copilot.getByRole('button', { name: /^Flaps 1 \(co-pilot, needs 1 or 2\)$/ }),
  ).toBeVisible();
});
