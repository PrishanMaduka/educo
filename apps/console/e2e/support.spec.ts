import { expect, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations, expectNoSideScroll } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { OWNER_STATE } from './sign-in-as';

/** The seeded school the support journeys open (CLAUDE.md seeded accounts). */
const SCHOOL = 'Colombo International School';
const OPEN_AS = `Open ${SCHOOL} as school admin`;

test.use({ storageState: OWNER_STATE });

/**
 * Answers the staff portal's support link here, so this journey stops at the link's shape; the
 * whole visit, through the real portal, is `journeys/support-banner.spec.ts`.
 */
async function catchStaffPortal(page: Page) {
  await page.route('http://localhost:3000/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Staff portal</title>' }),
  );
}

test.describe('Open as school admin (spec 05 → Support access)', () => {
  test('Schools lists the seeded schools, fits the screen and passes axe', async ({ page }) => {
    await page.goto('/schools');
    await expect(page.getByRole('heading', { level: 1, name: 'Schools' })).toBeVisible();
    await expect(page.getByText(/schools? (is|are) on Quad\./)).toBeVisible();
    await expect(page.getByText(SCHOOL).filter({ visible: true }).first()).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoSeriousA11yViolations(page);
  });

  test('a reason is always required, then the console follows the single-use link into the staff portal', async ({
    page,
  }, testInfo) => {
    await catchStaffPortal(page);
    await page.goto('/schools');
    await page.getByRole('button', { name: OPEN_AS }).filter({ visible: true }).first().click();
    const drawer = page.getByRole('dialog', { name: OPEN_AS });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: OPEN_AS }).click();
    await expect(drawer.getByText(/at least 10 characters/)).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await drawer
      .getByRole('textbox', { name: 'Why are you opening this school?' })
      .fill(`e2e ${testInfo.project.name}: checking the fee reminders the principal asked about`);
    await drawer.getByRole('button', { name: OPEN_AS }).click();
    await page.waitForURL(/^http:\/\/localhost:3000\/sign-in\/support\/[\w-]+\.[\w-]+$/);
    // Signed-link tokens stay in the path, never the query (D25).
    expect(new URL(page.url()).search).toBe('');
  });

  test(
    'Cancel closes the drawer and puts focus back on the school’s button',
    { tag: '@webkit' },
    async ({ page }) => {
      test.skip((page.viewportSize()?.width ?? 0) < 900, 'The desktop table holds the button');
      await page.goto('/schools');
      const button = page.getByRole('button', { name: OPEN_AS }).filter({ visible: true }).first();
      await button.click();
      const drawer = page.getByRole('dialog', { name: OPEN_AS });
      await expect(
        drawer.getByRole('textbox', { name: 'Why are you opening this school?' }),
      ).toBeFocused();
      await drawer.getByRole('button', { name: 'Cancel' }).click();
      await expect(drawer).toBeHidden();
      await expect(button).toBeFocused();
    },
  );
});
