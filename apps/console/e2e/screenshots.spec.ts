import { expect } from '@playwright/test';
import { saveScreenshot, takeScreenshots } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { OWNER_STATE, SUPPORT_STATE } from './sign-in-as';

/*
 * Review screenshots for docs/screenshots/m1 (QUAD_SCREENSHOTS=1 pnpm --filter @quad/console e2e
 * screenshots). Capture-only, never goldens. Each runs in all four projects (1440×900 and
 * 390×844, light and dark), still, and is named console-<screen>-<width>-<scheme>.png, except
 * the support banner, which is the staff portal's screen (staff-support-banner-…): this config
 * starts the portal on :3000, and a support visit starts in the console.
 */

const SCHOOL = 'Colombo International School';
const OPEN_AS = `Open ${SCHOOL} as school admin`;
const REASON = 'The principal asked for help with fee reminders (ticket 1042).';

test.describe('screenshots', () => {
  test.skip(!takeScreenshots, 'Set QUAD_SCREENSHOTS=1 to write the review screenshots');
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('console sign-in', async ({ page }, testInfo) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Quad' })).toBeVisible();
    await saveScreenshot(page, testInfo, 'm1', 'console-sign-in');
  });

  test.describe('as the owner', () => {
    test.use({ storageState: OWNER_STATE });

    test('Schools with the reason drawer', async ({ page }, testInfo) => {
      await page.goto('/schools');
      await expect(page.getByRole('heading', { level: 1, name: 'Schools' })).toBeVisible();
      await saveScreenshot(page, testInfo, 'm1', 'console-schools');
      await page.getByRole('button', { name: OPEN_AS }).filter({ visible: true }).first().click();
      const drawer = page.getByRole('dialog', { name: OPEN_AS });
      await drawer.getByRole('textbox', { name: 'Why are you opening this school?' }).fill(REASON);
      await saveScreenshot(page, testInfo, 'm1', 'console-schools-reason');
    });

    test('Audit log', async ({ page }, testInfo) => {
      await page.goto('/audit');
      await expect(
        page.getByRole('button', { name: /^Open the details of / }).first(),
      ).toBeVisible();
      await saveScreenshot(page, testInfo, 'm1', 'console-audit');
    });
  });

  // Each project opens a visit of its own from Quad support's shared session.
  test.describe('as Quad support', () => {
    test.use({ storageState: SUPPORT_STATE });

    test('the support banner in the staff portal', async ({ page }, testInfo) => {
      await page.goto('/schools');
      await page.getByRole('button', { name: OPEN_AS }).filter({ visible: true }).first().click();
      const drawer = page.getByRole('dialog', { name: OPEN_AS });
      await drawer.getByRole('textbox', { name: 'Why are you opening this school?' }).fill(REASON);
      await drawer.getByRole('button', { name: OPEN_AS }).click();
      await page.waitForURL('http://localhost:3000/app');
      await expect(page.getByRole('status').filter({ hasText: 'Support view' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await saveScreenshot(page, testInfo, 'm1', 'staff-support-banner');
    });
  });
});
