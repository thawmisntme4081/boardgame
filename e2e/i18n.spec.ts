import { expect, test } from '@playwright/test';
import { deviceOptions } from './helpers';

test('each player picks a language: a Vietnamese pilot and an English co-pilot play a die', async ({
  browser,
}, testInfo) => {
  const device = deviceOptions(testInfo.project.use);
  const pilot = await (await browser.newContext(device)).newPage();
  const copilot = await (await browser.newContext(device)).newPage();

  // English by default; the pilot switches to Vietnamese on the game's page.
  await pilot.goto('/play/sky-team');
  await expect(pilot.locator('html')).toHaveAttribute('lang', 'en');
  await pilot.getByRole('combobox', { name: 'Language' }).click();
  await pilot.getByRole('option', { name: 'Tiếng Việt' }).click();
  await expect(pilot.locator('html')).toHaveAttribute('lang', 'vi');

  // The choice survives a reload.
  await pilot.reload();
  await pilot.getByLabel('Tên', { exact: true }).fill('Ana');
  await pilot.getByRole('button', { name: 'Tạo ván mới' }).click();
  await expect(pilot.getByText('Đang chờ cơ phó của bạn')).toBeVisible();
  const code = (await pilot.getByLabel(/^Mã phòng/).textContent())!.trim();

  // The co-pilot's browser has its own choice: still English.
  await copilot.goto(`/r/${code}`);
  await copilot.getByLabel('Your name').fill('Ben');
  await copilot.getByRole('button', { name: 'Join' }).click();

  // Before take-off, in each player's language.
  await pilot.getByRole('button', { name: 'Phi công', exact: true }).click();
  await pilot.getByRole('button', { name: 'Xác nhận' }).click();
  await copilot.getByRole('button', { name: 'Confirm' }).click();
  await pilot.getByRole('button', { name: 'Đổ xúc xắc' }).click();
  await copilot.getByRole('button', { name: 'Roll dice' }).click();
  await expect(pilot.getByText('Lượt của bạn').first()).toBeVisible();
  await expect(copilot.getByText('Ana’s turn').first()).toBeVisible();

  // The pilot places one die from the Vietnamese tray.
  const dice = pilot.getByRole('button', { name: /^Xúc xắc của bạn/ });
  await expect(dice).toHaveCount(4);
  const die = dice.first();
  // WebKit can occasionally lose the local selection while the just-arrived game view settles.
  // Do not continue until the visible state confirms that this die is selected.
  await expect(async () => {
    if ((await die.getAttribute('aria-pressed')) !== 'true') await die.click();
    await expect(die).toHaveAttribute('aria-pressed', 'true');
  }).toPass({ timeout: 10_000 });
  await pilot.locator('button[data-valid]').first().click();
  await expect(dice).toHaveCount(3);
  await expect(copilot.getByText('Your turn').first()).toBeVisible();
});
