import { expect } from '@playwright/test';
import { saveScreenshot, takeScreenshots } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { OWNER_STATE } from './sign-in-as';

// Review screenshots for docs/screenshots/m1 (QUAD_SCREENSHOTS=1 pnpm --filter @quad/console e2e screenshots).
test.describe('screenshots', () => {
  test.skip(!takeScreenshots, 'Set QUAD_SCREENSHOTS=1 to write the review screenshots');

  const only = (width: number, scheme: 'light' | 'dark') => {
    test.skip(
      ({ viewport, colorScheme }) => viewport?.width !== width || colorScheme !== scheme,
      `Only at ${String(width)} ${scheme}`,
    );
  };

  test.describe('signed out', () => {
    only(1440, 'light');
    test('console sign-in', async ({ page }, testInfo) => {
      await page.goto('/sign-in');
      await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Quad' })).toBeVisible();
      await saveScreenshot(page, testInfo, 'm1', 'console-sign-in');
    });
  });

  test.describe('schools', () => {
    only(1440, 'light');
    test.use({ storageState: OWNER_STATE });
    test('Schools with the Open as school admin drawer', async ({ page }, testInfo) => {
      await page.goto('/schools');
      await page
        .getByRole('button', { name: /^Open .* as school admin$/ })
        .first()
        .click();
      const drawer = page.getByRole('dialog');
      await drawer
        .getByRole('textbox', { name: 'Why are you opening this school?' })
        .fill('The principal asked for help with fee reminders (ticket 1042).');
      await page.waitForTimeout(400);
      await saveScreenshot(page, testInfo, 'm1', 'console-schools-open-as');
    });
  });

  test.describe('audit', () => {
    only(390, 'dark');
    test.use({ storageState: OWNER_STATE });
    test('Audit log', async ({ page }, testInfo) => {
      await page.goto('/audit');
      await expect(
        page.getByRole('button', { name: /^Open the details of / }).first(),
      ).toBeVisible();
      await saveScreenshot(page, testInfo, 'm1', 'console-audit');
    });
  });
});
