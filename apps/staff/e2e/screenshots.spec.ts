import { expect, type Page } from '@playwright/test';
import { saveScreenshot, schemeOf, takeScreenshots } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { PEOPLE, PRISHAN_STATE, signInThroughApi } from './sign-in-as';
import { enterCode, enterEmail, enterPassword, title } from './steps';

/*
 * Review screenshots (QUAD_SCREENSHOTS=1 pnpm --filter @quad/staff e2e screenshots). They are
 * capture-only, never goldens: each is set beside the prototype at the same size.
 *
 * M1 (Task 27): docs/screenshots/m1/staff-<screen>-<width>-<scheme>.png, in all four projects
 * (1440×900 and 390×844, light and dark), still (reduced motion; `saveScreenshot` also finishes
 * animations). Password calls in one screenshot run, per address (10 per 15 minutes, see
 * `sign-in-as.ts`): Prishan 1 global + 4 (the role preview) = 5; Nadeesha 4 (the two-step
 * step); Ruwan 4 (Choose a school). Nothing else in the run signs them in.
 */

const CIS = 'Colombo International School';
const KHA = 'Kandy Hill Academy';

/** docs/screenshots/m1/staff-<name>-<width>-<scheme>.png. */
const shoot = (page: Page, testInfo: Parameters<typeof saveScreenshot>[1], name: string) =>
  saveScreenshot(page, testInfo, 'm1', `staff-${name}`);

test.describe('screenshots', () => {
  test.skip(!takeScreenshots, 'Set QUAD_SCREENSHOTS=1 to write the review screenshots');
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  // The M1 screens (Task 27): `-g "screenshots m1"` writes only these.
  test.describe('m1', () => {
    test.describe('sign-in', () => {
      test('each step of /sign-in', async ({ page, stack }, testInfo) => {
        await page.goto('/sign-in');
        await expect(title(page, 'Sign in to Quad')).toBeVisible();
        await shoot(page, testInfo, 'sign-in-email');

        await enterEmail(page, PEOPLE.nadeesha);
        await shoot(page, testInfo, 'sign-in-password');

        await enterPassword(page, stack.seedPassword);
        await expect(title(page, 'Two-step sign-in')).toBeVisible();
        await shoot(page, testInfo, 'sign-in-code');
      });

      test('Forgot password and Check your inbox', async ({ page }, testInfo) => {
        // Forgot answers 3 times per address in 15 minutes: an address per project.
        await page.goto('/sign-in');
        await enterEmail(page, `forgot.${testInfo.project.name}@colombo-intl.local`);
        await page.getByRole('button', { name: 'Forgot password?' }).click();
        await expect(title(page, 'Reset your password')).toBeVisible();
        await shoot(page, testInfo, 'sign-in-forgot');
        await page.getByRole('button', { name: 'Send reset link' }).click();
        await expect(title(page, 'Check your inbox')).toBeVisible();
        await shoot(page, testInfo, 'sign-in-sent');
      });

      test('Choose a school, then the portal in Kandy Hill Academy’s colours', async ({
        page,
        stack,
      }, testInfo) => {
        await page.goto('/sign-in');
        await enterEmail(page, PEOPLE.ruwan);
        await enterPassword(page, stack.seedPassword);
        await enterCode(page, stack.fixedCode);
        await expect(title(page, 'Choose a school')).toBeVisible();
        await shoot(page, testInfo, 'choose-school');

        await page.getByRole('button', { name: new RegExp(KHA) }).click();
        await expect(page).toHaveURL('/app/teaching');
        await expect(page.getByText('My teaching arrives soon')).toBeVisible();
        await shoot(page, testInfo, 'app-kha');
      });
    });

    test.describe('signed in as Prishan', () => {
      test.use({ storageState: PRISHAN_STATE });

      test('/app in Colombo International School’s colours', async ({ page }, testInfo) => {
        await page.goto('/app');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByText(CIS).first()).toBeAttached();
        await shoot(page, testInfo, 'app-cis');
      });

      test('Users & roles: People, Roles, Invite staff and New role', async ({
        page,
      }, testInfo) => {
        const PATH = '/app/settings/users';
        await page.goto(PATH);
        await expect(page.getByRole('heading', { level: 1, name: 'Users & roles' })).toBeVisible();
        // The table from 1024 px, the cards below it.
        await expect(
          page.getByRole((page.viewportSize()?.width ?? 0) < 1024 ? 'list' : 'table', {
            name: 'Staff accounts',
          }),
        ).toBeVisible();
        await shoot(page, testInfo, 'users-people');

        await page.getByRole('button', { name: 'Invite staff' }).click();
        const drawer = page.getByRole('dialog', { name: 'Invite staff' });
        await expect(drawer.getByLabel('Email addresses')).toBeVisible();
        await shoot(page, testInfo, 'users-invite');
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();

        await page.goto(`${PATH}?tab=roles`);
        await page
          .getByRole('group', { name: 'Roles' })
          .getByRole('button', { name: /^Teacher/ })
          .click();
        await expect(page.getByRole('table', { name: 'What Teacher can do' })).toBeVisible();
        await shoot(page, testInfo, 'users-roles');

        await page.getByRole('link', { name: 'New role' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'New role' })).toBeVisible();
        await shoot(page, testInfo, 'users-new-role');
      });

      test('School settings: General, Sign-in and Audit', async ({ page }, testInfo) => {
        const PATH = '/app/settings/school';
        await page.goto(PATH);
        await expect(page.getByLabel('School name')).toBeVisible();
        await shoot(page, testInfo, 'settings-general');

        await page.goto(`${PATH}?tab=sign-in`);
        await expect(page.getByText('Managed by Quad. Ask support to change them.')).toBeVisible();
        await shoot(page, testInfo, 'settings-sign-in');

        await page.goto(`${PATH}?tab=audit`);
        await expect(
          page.getByRole('button', { name: /^Open the details of / }).first(),
        ).toBeVisible();
        await shoot(page, testInfo, 'settings-audit');
      });
    });

    // A preview changes the session, so Prishan signs in on a session of this test's own.
    test('the preview banner and the no-access page (Preview as Finance officer)', async ({
      page,
    }, testInfo) => {
      await signInThroughApi(page.request, PEOPLE.prishan);
      await page.goto('/app/settings/users');
      await page
        .getByRole('region', { name: 'Preview a role' })
        .getByRole('button', { name: 'Preview as Finance officer' })
        .click();
      await expect(page).toHaveURL('/app');
      const banner = page.getByRole('status').filter({ hasText: 'Previewing as Finance officer' });
      await expect(banner).toBeVisible();
      await shoot(page, testInfo, 'preview-banner');

      await page.goto('/app/timetable');
      await expect(title(page, 'Timetable isn’t part of the Finance officer role')).toBeVisible();
      await shoot(page, testInfo, 'no-access');

      await page.goto('/app');
      await banner.getByRole('button', { name: 'Back to my view' }).click();
      await expect(page.getByText('Previewing as')).toHaveCount(0);
    });
  });

  // docs/screenshots/landing/app-<width>-<scheme>.png, to set beside the prototype renders in the
  // same folder.
  test('/ (landing)', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await saveScreenshot(page, testInfo, 'landing', 'app');
  });

  // The parent view in light: docs/screenshots/landing/app-parent-<width>-light.png.
  test('/?view=parent (landing)', async ({ page }, testInfo) => {
    test.skip(schemeOf(testInfo) !== 'light', 'The parent view is reviewed in light');
    await page.goto('/?view=parent');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'Hear the good stuff first, in the app.',
    );
    await saveScreenshot(page, testInfo, 'landing', 'app-parent');
  });

  // The About, Security & trust and legal pages (D41, D45): docs/screenshots/landing/<name>-<width>-<scheme>.png,
  // each at 1440 px in light and 390 px in dark (reduced motion stops the big mark turning).
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
      await page.goto(shot.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await saveScreenshot(page, testInfo, 'landing', shot.name);
    });
  }

  test('/design', async ({ page }, testInfo) => {
    await page.goto('/design');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await saveScreenshot(page, testInfo, 'm0', 'staff-design');
  });
});
