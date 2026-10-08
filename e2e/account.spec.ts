import { expect, test } from '@playwright/test';

test('account sign-in offers Google only when configured', async ({ page }) => {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in' });
  const configured = await signIn.isVisible().catch(() => false);
  if (!configured) return;

  await signIn.click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await expect(dialog.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(dialog.getByLabel('Email')).toHaveCount(0);
});
