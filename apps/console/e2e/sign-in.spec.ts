import { expect, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations, expectNoSideScroll } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { OWNER_STATE, PASSWORD_JOURNEY_PROJECTS, QUAD_STAFF } from './sign-in-as';

/** The card has faded in (axe would otherwise sample it mid-animation). */
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  );
}

test.describe('console sign-in (spec 05, D37)', () => {
  test(
    'a signed-out deep link goes to sign-in, coming back to the page asked for',
    { tag: '@webkit' },
    async ({ page }) => {
      await page.goto('/audit?from=x');
      await expect(page).toHaveURL(/\/sign-in\?next=%2Faudit%3Ffrom%3Dx$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Quad' })).toBeVisible();
    },
  );

  test(
    'a signed-in session opens a deep link in a new context, not sign-in (SameSite=Strict, D32)',
    { tag: '@webkit' },
    async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        storageState: OWNER_STATE,
        baseURL: testInfo.project.use.baseURL,
        colorScheme: testInfo.project.use.colorScheme,
        viewport: testInfo.project.use.viewport,
      });
      try {
        const page = await context.newPage();
        await page.goto('/audit');
        await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
        await expect(page).toHaveURL(/\/audit$/);
      } finally {
        await context.close();
      }
    },
  );

  test(
    'Quad support signs in with email, password and the authenticator, then lands on the page asked for',
    { tag: '@webkit' },
    async ({ page, stack }, testInfo) => {
      test.skip(
        !PASSWORD_JOURNEY_PROJECTS.includes(testInfo.project.name),
        'Password journeys run in three projects (the per-email limit)',
      );
      await page.goto('/sign-in?next=/schools');
      await page.getByLabel('Quad email').fill(QUAD_STAFF.support.email);
      await page.getByLabel('Password', { exact: true }).fill(stack.seedPassword);
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Two-step sign-in' })).toBeVisible();
      await page.getByLabel('Digit 1 of 6').click();
      await page.keyboard.type(stack.fixedCode);
      await expect(page).toHaveURL(/\/schools$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Schools' })).toBeVisible();
      // The side bar names who is signed in (phones keep it in the menu).
      if ((page.viewportSize()?.width ?? 0) >= 900) {
        await expect(
          page.getByRole('complementary', { name: 'Side bar' }).getByText(QUAD_STAFF.support.name),
        ).toBeVisible();
      }
    },
  );

  test('a wrong password says only that the email and password don’t match', async ({
    page,
    stack,
  }, testInfo) => {
    await page.goto('/sign-in');
    // An address no seeded person has, so no one is locked by a run.
    await page
      .getByLabel('Quad email')
      .fill(`no.account.${testInfo.project.name}.${String(testInfo.retry)}@quad.local`);
    await page.getByLabel('Password', { exact: true }).fill(stack.seedPassword);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'don’t match' })).toHaveText(
      'That email and password don’t match. Check them and try again.',
    );
  });

  test('offers no Google, Microsoft or other single sign-on, fits 390 px and passes axe', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Quad' })).toBeVisible();
    await expect(page.getByText(/google|microsoft|workspace/i)).toHaveCount(0);
    await expect(
      page.getByText('Every sign-in to the platform console is recorded in the audit log.'),
    ).toBeVisible();
    await settled(page);
    await expectNoSideScroll(page);
    await expectNoSeriousA11yViolations(page);
  });
});
