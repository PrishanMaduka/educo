import { expect, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { PASSWORD_JOURNEY_PROJECTS, QUAD_STAFF } from '../sign-in-as';

/*
 * Journey 42 (spec 17), "Console sign-in": owner@quad.local signs in to the console with email,
 * password and TOTP, the same in every environment; there is no Google or Microsoft button
 * (D37); a wrong TOTP code is refused; an email that is not an active platform user gets the
 * same answer as a wrong password. It also holds Task 23's Sign out journey, in the same session,
 * so the owner's password calls per run stay at 1 + 2 × (3 + 1) = 9 (`PASSWORD_JOURNEY_PROJECTS`).
 */

const WRONG_PASSWORD = 'That email and password don’t match. Check them and try again.';
const WRONG_CODE = 'That code didn’t work. Check your authenticator app and try again.';
const title = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

/** The card has faded in (axe would otherwise sample it mid-animation). */
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  );
}

async function enterCredentials(page: Page, email: string, password: string) {
  await page.getByLabel('Quad email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function typeCode(page: Page, code: string) {
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type(code);
}

/** The password step's answer and the message the page shows for it. */
async function refusedPassword(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  const answer = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/platform/auth/password') &&
      response.request().method() === 'POST',
  );
  await enterCredentials(page, email, password);
  const response = await answer;
  const alert = page.getByRole('alert').filter({ hasText: 'don’t match' });
  await expect(alert).toHaveText(WRONG_PASSWORD);
  return { status: response.status(), body: await response.text() };
}

test.describe('J42: console sign-in', () => {
  test(
    'the owner signs in with email, password and the authenticator, after a wrong code is refused, then signs out',
    { tag: '@webkit' },
    async ({ page, stack }, testInfo) => {
      test.skip(
        !PASSWORD_JOURNEY_PROJECTS.includes(testInfo.project.name),
        'The owner signs in with a password: see PASSWORD_JOURNEY_PROJECTS for the per-email limit',
      );
      await page.goto('/');
      await expect(page).toHaveURL(/\/sign-in\?next=%2F$/);
      await expect(title(page, 'Sign in to Quad')).toBeVisible();
      await expect(page.getByText(/google|microsoft/i)).toHaveCount(0);
      await settled(page);
      await expectNoSeriousA11yViolations(page);

      await enterCredentials(page, QUAD_STAFF.owner.email, stack.seedPassword);
      await expect(title(page, 'Two-step sign-in')).toBeVisible();
      await expect(page.getByText(/google|microsoft/i)).toHaveCount(0);
      // Any code but the stack's fixed one (000000) is wrong.
      await typeCode(page, '123456');
      await expect(page.getByRole('alert').filter({ hasText: 'code' })).toHaveText(WRONG_CODE);
      await expect(title(page, 'Two-step sign-in')).toBeVisible();
      await expect(page).toHaveURL(/\/sign-in/);

      await typeCode(page, stack.fixedCode);
      await expect(title(page, 'Overview')).toBeVisible();
      await expect(page).toHaveURL(/:\d+\/$/);
      await expectNoSeriousA11yViolations(page);

      // Sign out (Task 23) ends this session: every page then goes to sign-in.
      await page.getByRole('button', { name: 'Open your profile menu' }).click();
      const menu = page.getByRole('dialog', { name: 'Your profile' });
      await expect(menu.getByText(QUAD_STAFF.owner.name).first()).toBeVisible();
      await menu.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL(/\/sign-in$/);
      await page.goto('/schools');
      await expect(page).toHaveURL(/\/sign-in\?next=%2Fschools$/);
    },
  );

  test('an address that is no platform user gets exactly the answer a wrong password gets', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-light',
      'One wrong owner password per run: the per-email limit and the lockout (5 in 15 minutes)',
    );
    const wrong = await refusedPassword(page, QUAD_STAFF.owner.email, 'not the owner’s password');
    const unknown = await refusedPassword(page, 'someone@gmail.com', 'not the owner’s password');
    expect(unknown).toEqual(wrong);
  });
});
