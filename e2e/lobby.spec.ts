import { expect, test } from '@playwright/test';

test('create a game and see the invite code', async ({ page }) => {
  await page.goto('/');
  const create = page.getByRole('button', { name: 'Create a game' });
  await expect(create).toBeDisabled();
  await page.getByLabel('Your name').fill('Ana');
  await create.click();
  await expect(page.getByText('Waiting for your co-pilot')).toBeVisible();
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
