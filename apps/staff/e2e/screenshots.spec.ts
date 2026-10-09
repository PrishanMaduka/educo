import { expect } from '@playwright/test';
import { saveScreenshot, schemeOf, takeScreenshots } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { PRISHAN_STATE } from './sign-in-as';

// Review screenshots for docs/screenshots/m0 (QUAD_SCREENSHOTS=1 pnpm --filter @quad/staff e2e screenshots).
test.describe('screenshots', () => {
  test.skip(!takeScreenshots, 'Set QUAD_SCREENSHOTS=1 to write the review screenshots');

  // docs/screenshots/m1/shell-<width>-<scheme>.png: the signed-in shell (Task 20), signed in
  // through the stack as Prishan, at 1440 px in light and 390 px in dark, still.
  test.describe('signed in', () => {
    test.use({ storageState: PRISHAN_STATE });

    test('/app (shell)', async ({ page }, testInfo) => {
      const width = page.viewportSize()?.width;
      const scheme = schemeOf(testInfo);
      test.skip(
        !(width === 1440 && scheme === 'light') && !(width === 390 && scheme === 'dark'),
        'Reviewed at 1440 px in light and 390 px in dark',
      );
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/app');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await saveScreenshot(page, testInfo, 'm1', 'shell');
    });
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

  // The About, Security & trust and legal pages (D41, D45): docs/screenshots/landing/<name>-<width>-<scheme>.png,
  // each at 1440 px in light and 390 px in dark, still (reduced motion stops the big mark turning).
  for (const shot of [
    { path: '/about', name: 'about' },
    { path: '/security', name: 'security' },
    { path: '/legal/privacy', name: 'privacy' },
    { path: '/legal/terms', name: 'terms' },
  ] as const) {
    test(`${shot.path} (${shot.name})`, async ({ page }, testInfo) => {
      const width = page.viewportSize()?.width;
      const scheme = schemeOf(testInfo);
      test.skip(
        !(width === 1440 && scheme === 'light') && !(width === 390 && scheme === 'dark'),
        'Reviewed at 1440 px in light and 390 px in dark',
      );
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(shot.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await saveScreenshot(page, testInfo, 'landing', shot.name);
    });
  }

  // docs/screenshots/m1/sign-in-<width>-<scheme>.png: the work email step, at 1440 px in light
  // and 390 px in dark (Task 19).
  test('/sign-in', async ({ page }, testInfo) => {
    const width = page.viewportSize()?.width;
    const scheme = schemeOf(testInfo);
    test.skip(
      !(width === 1440 && scheme === 'light') && !(width === 390 && scheme === 'dark'),
      'Reviewed at 1440 px in light and 390 px in dark',
    );
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Quad' })).toBeVisible();
    await saveScreenshot(page, testInfo, 'm1', 'sign-in');
  });

  test('/design', async ({ page }, testInfo) => {
    await page.goto('/design');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await saveScreenshot(page, testInfo, 'm0', 'staff-design');
  });
});
