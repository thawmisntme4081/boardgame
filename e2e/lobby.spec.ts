import { expect, test } from '@playwright/test';
import { deviceOptions } from './helpers';

test('pick Sky Team, create a game and see the invite code', async ({ page }) => {
  // The game picker loads without any game's code: the board comes with the game's page.
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Board games' })).toBeVisible();
  expect(scripts.filter((url) => url.includes('/assets/sky-team-'))).toEqual([]);

  await page.getByRole('link', { name: /^Sky Team/ }).click();
  await expect(page).toHaveURL(/\/play\/sky-team$/);
  const create = page.getByRole('button', { name: 'Create a game' });
  await expect(create).toBeDisabled();
  await page.getByLabel('Your name').fill('Ana');
  await create.click();
  await expect(page.getByText('Waiting for your teammate')).toBeVisible();
  await expect(page.getByLabel(/^Game code/)).toHaveText(/^[A-HJ-NP-Z]{4}$/);
  await expect(page).toHaveURL(/\/r\/[A-Z]{4}$/);
});

test('joining an unknown code shows an error', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Ben');
  await page.getByLabel('Game code').fill('qqqq');
  await expect(page.getByLabel('Game code')).toHaveValue('QQQQ');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText('No game with that code.')).toBeVisible();
});

test('an invite link opens the join form with the code', async ({ page }) => {
  await page.goto('/r/abcd');
  await expect(page.getByLabel('Game code')).toHaveValue('ABCD');
  await expect(page.getByRole('button', { name: 'Create a game' })).toHaveCount(0);
});

test('the creator chooses the seats before round 1; the traffic die waits for both confirms', async ({
  browser,
}, testInfo) => {
  const device = deviceOptions(testInfo.project.use);
  const pilot = await (await browser.newContext(device)).newPage();
  const copilot = await (await browser.newContext(device)).newPage();
  await pilot.goto('/play/sky-team');
  await pilot.getByLabel('Your name').fill('Ana');
  await pilot.getByRole('button', { name: 'Create a game' }).click();
  // Wait for the waiting room: the lobby's own "Game code" field would match too.
  await expect(pilot.getByText('Waiting for your teammate')).toBeVisible();
  const code = (await pilot.getByLabel(/^Game code/).textContent())!.trim();
  await copilot.goto(`/r/${code}`);
  await expect(copilot.getByLabel('Game code')).toHaveValue(code);
  await copilot.getByLabel('Your name').fill('Ben');
  await copilot.getByRole('button', { name: 'Join' }).click();

  const panel = (page: typeof pilot) => page.getByRole('region', { name: 'Before take-off' });
  await expect(panel(copilot).getByText('Ana chooses the seats.')).toBeVisible();
  await expect(panel(copilot).getByRole('button', { name: 'Pilot', exact: true })).toBeDisabled();
  // Ana takes the co-pilot seat: Ben becomes the pilot.
  await panel(pilot).getByRole('button', { name: 'Co-pilot', exact: true }).click();
  await expect(panel(copilot).getByRole('button', { name: 'Pilot', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await panel(pilot).getByRole('button', { name: 'Confirm' }).click();
  await expect(panel(copilot).getByText('Ana has confirmed.')).toBeVisible();
  await panel(copilot).getByRole('button', { name: 'Confirm' }).click();
  await expect(pilot.getByRole('button', { name: 'Roll dice' })).toBeVisible();
  await expect(panel(pilot)).toHaveCount(0);
});
