import { expect, test } from '@playwright/test';
import { saveScreenshot, schemeOf, takeScreenshots } from '@quad/config/playwright/checks';

// Review screenshots for docs/screenshots/m0 (QUAD_SCREENSHOTS=1 pnpm --filter @quad/staff e2e screenshots).
test.describe('screenshots', () => {
  test.skip(!takeScreenshots, 'Set QUAD_SCREENSHOTS=1 to write the review screenshots');

  test('/app', async ({ page }, testInfo) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await saveScreenshot(page, testInfo, 'm0', 'staff-app');
  });

  // docs/screenshots/landing/app-<width>-<scheme>.png, still (reduced motion), to set beside the
  // prototype renders in the same folder.
  test('/ (landing)', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await saveScreenshot(page, testInfo, 'landing', 'app');
  });

  // The parent view in light: docs/screenshots/landing/app-parent-<width>-light.png.
  test('/?view=parent (landing)', async ({ page }, testInfo) => {
    test.skip(schemeOf(testInfo) !== 'light', 'The parent view is reviewed in light');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?view=parent');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'Hear the good stuff first, in the app.',
    );
    await saveScreenshot(page, testInfo, 'landing', 'app-parent');
  });

  test('/design', async ({ page }, testInfo) => {
    await page.goto('/design');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await saveScreenshot(page, testInfo, 'm0', 'staff-design');
  });
});
