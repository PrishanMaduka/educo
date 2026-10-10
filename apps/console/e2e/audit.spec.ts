import { expect } from '@playwright/test';
import { expectAccessibleOnceStill, expectNoSideScroll } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { OWNER_STATE, QUAD_STAFF } from './sign-in-as';

test.use({ storageState: OWNER_STATE });

test.describe('Audit log (spec 07)', () => {
  test('shows the owner’s console sign-in, filtered by Quad staff and action, and passes axe', async ({
    page,
  }) => {
    await page.goto('/audit');
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
    await page.getByRole('button', { name: /^Quad staff/ }).click();
    await page.getByRole('option', { name: QUAD_STAFF.owner.name }).click();
    await page.getByRole('button', { name: /^Action/ }).click();
    await page.getByRole('option', { name: 'Signed in', exact: true }).click();
    const list = page.getByRole((page.viewportSize()?.width ?? 0) < 768 ? 'list' : 'table', {
      name: 'Audit log entries',
    });
    await expect(list.getByRole('button', { name: /^Open the details of / }).first()).toBeVisible();
    await expect(list.getByText(QUAD_STAFF.owner.name).first()).toBeVisible();
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);
  });

  test(
    'an entry opens in a drawer, and Back to the log returns focus to it',
    { tag: '@webkit' },
    async ({ page }) => {
      await page.goto('/audit');
      const entry = page.getByRole('button', { name: /^Open the details of / }).first();
      await entry.click();
      const drawer = page.getByRole('dialog');
      await expect(drawer.getByText('IP address')).toBeVisible();
      await expectAccessibleOnceStill(page);
      await drawer.getByRole('button', { name: 'Back to the log' }).click();
      await expect(drawer).toBeHidden();
      await expect(entry).toBeFocused();
    },
  );

  test('Export CSV downloads the filtered entries and says so', async ({ page }) => {
    await page.goto('/audit');
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    expect((await download).suggestedFilename()).toMatch(/^quad-platform-audit-.*\.csv$/);
    await expect(page.getByText('Audit log exported')).toBeVisible();
  });
});
