import { expect, test } from '@playwright/test';
import { saveScreenshot, takeScreenshots } from '@quad/config/playwright/checks';

// Review screenshots for docs/screenshots/m0 (QUAD_SCREENSHOTS=1 pnpm --filter @quad/staff e2e screenshots).
test.describe('screenshots', () => {
  test.skip(!takeScreenshots, 'Set QUAD_SCREENSHOTS=1 to write the review screenshots');

  test('/app', async ({ page }, testInfo) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await saveScreenshot(page, testInfo, 'm0', 'staff-app');
  });

  test('/design', async ({ page }, testInfo) => {
    await page.goto('/design');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await saveScreenshot(page, testInfo, 'm0', 'staff-design');
  });
});
