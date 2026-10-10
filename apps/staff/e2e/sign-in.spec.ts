import { expect } from '@playwright/test';
import { expectNoSideScroll } from '@quad/config/playwright/checks';
import { tamperedTestLink } from '@quad/config/playwright/signed-token';
import { test } from '@quad/config/playwright/stack';

import { enterEmail, enterPassword, expectAccessibleOnceStill, title } from './steps';

/*
 * Staff sign-in against the e2e stack (Task 18's API with Task 17's seed): the sign-in card's
 * steps without a seeded person's password (no account hints, forgot password, a refused reset
 * link, the two-step notice, axe at each step). The full sign-ins are journeys 17 and 18 in
 * `journeys/` (Task 26), where the API's per-email limit is counted.
 */

const PRISHAN = 'prishan.maduka@colombo-intl.local';

test.describe('staff sign-in', () => {
  test('a signed-out visit to the portal goes to sign-in, keeping the page as ?next=', async ({
    page,
  }) => {
    const response = await page.request.get('/app', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('/sign-in?next=%2Fapp');
  });

  test('says why when Switch school sent the person back for two-step, and shows no other notice', async ({
    page,
  }) => {
    await page.goto('/sign-in?next=%2Fapp&notice=two_step');
    await expect(page.getByRole('status')).toHaveText(
      'The school you chose asks for a two-step code. Sign in again to set it up.',
    );
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);
    await page.goto('/sign-in?next=%2Fapp&notice=%3Cb%3EPay%20here%3C%2Fb%3E');
    await expect(title(page, 'Sign in to Quad')).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Pay here');
  });

  test('offers no Google or Microsoft sign-in (D37)', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(title(page, 'Sign in to Quad')).toBeVisible();
    await expect(page.getByText(/google|microsoft/i)).toHaveCount(0);
    await enterEmail(page, PRISHAN);
    await expect(page.getByText(/google|microsoft/i)).toHaveCount(0);
  });

  test('a wrong password says so, without saying whether the account exists', async ({
    page,
  }, testInfo) => {
    // An address with no account, new for each project and retry: the answer is the same as for
    // a real account's wrong password (no account hints), and no seeded person is ever locked.
    const email = `no.account.${testInfo.project.name}.${String(testInfo.retry)}@colombo-intl.local`;
    await page.goto('/sign-in');
    await enterEmail(page, email);
    await enterPassword(page, 'not the right password');
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      'That email and password don’t match. Check them and try again.',
    );
    await expect(title(page, 'Welcome back')).toBeVisible();
  });

  test('Forgot password shows Check your inbox', async ({ page }, testInfo) => {
    // Its own address per project: forgot answers 3 times per address in 15 minutes.
    const email = `forgot.${testInfo.project.name}@colombo-intl.local`;
    await page.goto('/sign-in');
    await enterEmail(page, email);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(title(page, 'Reset your password')).toBeVisible();
    await expect(page.getByLabel('Work email')).toHaveValue(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(title(page, 'Check your inbox')).toBeVisible();
    await expect(page.getByText(`If ${email} has a Quad account`, { exact: false })).toBeVisible();
  });

  test('a tampered reset link is not valid any more, and names no school', async ({ page }) => {
    const token = tamperedTestLink({
      purpose: 'password_reset',
      tid: null,
      // No one's account, so a regression could never reset a seeded person's password.
      sub: '01926f00-0000-7000-8000-00000000dead',
      exp: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    const response = await page.goto(`/sign-in/reset/${token}`);
    expect(response?.headers()['referrer-policy']).toBe('no-referrer');
    expect(response?.headers()['x-robots-tag']).toMatch(/^noindex/);

    await page.getByLabel('New password', { exact: true }).fill('a brand new passphrase');
    await page.getByRole('button', { name: 'Change my password' }).click();
    await expect(title(page, 'This link isn’t valid any more')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Colombo|Kandy/);
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  test('fits the screen and passes axe at each step', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(title(page, 'Sign in to Quad')).toBeVisible();
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);

    await enterEmail(page, PRISHAN);
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);

    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(title(page, 'Reset your password')).toBeVisible();
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);

    await page.goto('/sign-in/reset/not-a-token');
    await expect(title(page, 'Choose a new password')).toBeVisible();
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);
  });
});
