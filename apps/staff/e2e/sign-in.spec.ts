import { expect, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations, expectNoSideScroll } from '@quad/config/playwright/checks';
import { tamperedTestLink } from '@quad/config/playwright/signed-token';
import { test } from '@quad/config/playwright/stack';

import { PASSWORD_JOURNEY_PROJECTS } from './sign-in-as';

/*
 * Staff sign-in against the e2e stack (Task 18's API with Task 17's seed): identifier first, the
 * password, two-step with the stack's fixed code, Choose a school, forgot password and a
 * refused reset link (spec 05; spec 17 journeys). Journeys that sign a seeded person in with a
 * password run on `PASSWORD_JOURNEY_PROJECTS`, where the API's per-email limit is counted.
 */

const PRISHAN = 'prishan.maduka@colombo-intl.local';
const RUWAN = 'ruwan.mendis@quad.local';
const GREETING = /^(Good morning|Good afternoon|Good evening|Hello), Prishan$/;

const title = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name });

async function enterEmail(page: Page, email: string): Promise<void> {
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(title(page, 'Welcome back')).toBeVisible();
}

async function enterPassword(page: Page, password: string): Promise<void> {
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Types the code into the six boxes; the step sends it once the last box is filled. */
async function enterCode(page: Page, code: string): Promise<void> {
  await expect(title(page, 'Two-step sign-in')).toBeVisible();
  await page.getByRole('textbox', { name: 'Digit 1 of 6' }).click();
  await page.keyboard.type(code);
}

/** Each step's card fades in; axe must not sample its colours halfway. */
async function expectAccessibleOnceStill(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  );
  await expectNoSeriousA11yViolations(page);
}

test.describe('staff sign-in', () => {
  test('a signed-out visit to the portal goes to sign-in, keeping the page as ?next=', async ({
    page,
  }) => {
    const response = await page.request.get('/app', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe('/sign-in?next=%2Fapp');
  });

  test(
    'email, then password, then the code, lands in the portal',
    { tag: '@webkit' },
    async ({ page, stack }, testInfo) => {
      test.skip(
        !PASSWORD_JOURNEY_PROJECTS.includes(testInfo.project.name),
        'Prishan signs in with a password: see PASSWORD_JOURNEY_PROJECTS for the per-email limit',
      );
      await page.goto('/app');
      await expect(page).toHaveURL('/sign-in?next=%2Fapp');
      await expect(title(page, 'Sign in to Quad')).toBeVisible();

      await enterEmail(page, PRISHAN);
      await expect(page.getByText(PRISHAN)).toBeVisible();
      await enterPassword(page, stack.seedPassword);
      await enterCode(page, stack.fixedCode);

      // "Opening Colombo International School…" shows only while the portal loads (component test).
      await expect(page).toHaveURL('/app');
      await expect(title(page, GREETING)).toBeVisible();
    },
  );

  test('a teacher at two schools chooses one, and it opens', async ({ page, stack }, testInfo) => {
    test.skip(
      !PASSWORD_JOURNEY_PROJECTS.includes(testInfo.project.name),
      'Ruwan signs in with a password: see PASSWORD_JOURNEY_PROJECTS for the per-email limit',
    );
    await page.goto('/sign-in');
    await enterEmail(page, RUWAN);
    await enterPassword(page, stack.seedPassword);
    await enterCode(page, stack.fixedCode);

    await expect(title(page, 'Choose a school')).toBeVisible();
    await expect(
      page.getByText(`${RUWAN} is linked to 2 schools on Quad.`, { exact: false }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Kandy Hill Academy/ }).click();
    // A teacher's home is My teaching: /app sends them there (Task 20).
    await expect(page).toHaveURL('/app/teaching');
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
      sub: '01926f00-0000-7000-8000-000000000101',
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
