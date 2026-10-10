import { expect, type Page } from '@playwright/test';
import { expectNoSideScroll } from '@quad/config/playwright/checks';
import { Mailpit, linkIn } from '@quad/config/playwright/mailpit';
import {
  expiredTestLink,
  signTestLink,
  tamperedTestLink,
} from '@quad/config/playwright/signed-token';
import { contextOptionsFor, test } from '@quad/config/playwright/stack';

import { PRISHAN_STATE } from '../sign-in-as';
import { createStaffMember, inviteeAddress } from '../staff-accounts';
import { enterEmail, expectAccessibleOnceStill, title } from '../steps';

/*
 * Journey 43 (spec 17), "Tenant-less entry points", the M1 part: a password-reset link from
 * Mailpit works once and is refused the second time; forged, expired, wrong-purpose and tampered
 * tokens are refused on each signed-link page without naming a school; an enquiry with an unknown
 * embed key is refused. The webhook steps arrive with M7 (spec 17 says "webhooks from M7"), so
 * they are `test.fixme`, not skipped. Expired and wrong-purpose links are signed by the
 * `signed-token` helper with the stack's local secret (the stack has no fake clock). The reset
 * is for a person this test invites (Prishan's shared session, no password call), so no seeded
 * person's password changes and each project has its own forgot budget (3 per address).
 */

const CIS_ID = '01926f00-0000-7000-8000-000000000001';
const NEW_PASSWORD = 'a brand new passphrase for e2e';
const NOT_VALID = 'This link isn’t valid any more';
const SCHOOL_NAMES = /Colombo|Kandy|CIS\b|KHA\b/;
const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;
const someone = '01926f00-0000-7000-8000-000000000101';

/** Every way a link is refused: forged (another key), expired, wrong purpose, tampered. */
function badLinks(purpose: string, tid: string | null): Record<string, string> {
  const payload = { purpose, tid, sub: someone, exp: inAnHour() };
  return {
    'signed with another key': signTestLink(payload, 'not the stack’s link-signing secret'),
    'past its expiry': expiredTestLink({ purpose, tid, sub: someone }),
    'meant for another purpose': signTestLink({
      ...payload,
      purpose: purpose === 'password_reset' ? 'staff_invite' : 'password_reset',
    }),
    'changed after signing': tamperedTestLink(payload),
  };
}

async function expectInvalidWithoutSchool(page: Page) {
  await expect(title(page, NOT_VALID)).toBeVisible();
  await expect(page.locator('body')).not.toContainText(SCHOOL_NAMES);
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
    'href',
    '/sign-in',
  );
}

async function chooseNewPassword(page: Page, token: string) {
  await page.goto(`/sign-in/reset/${token}`);
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Change my password' }).click();
}

test.describe('J43: tenant-less entry points', () => {
  test('a reset link from the email works once, then is refused', async ({
    page,
    browser,
    stack,
  }, testInfo) => {
    const email = inviteeAddress(testInfo, 'reset.me');
    const admin = await browser.newContext(contextOptionsFor(testInfo, 'admin', PRISHAN_STATE));
    try {
      await createStaffMember(admin.request, page.request, {
        email,
        role: 'Teacher',
        password: stack.seedPassword,
      });
    } finally {
      await admin.close();
    }
    await page.context().clearCookies();

    await page.goto('/sign-in');
    await enterEmail(page, email);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(title(page, 'Check your inbox')).toBeVisible();
    const message = await new Mailpit().waitForMessage({
      to: email,
      subject: 'Reset your Quad password',
    });
    const link = linkIn(message.text, '/sign-in/reset/');
    expect(link).not.toBeNull();
    const token = new URL(link ?? '').pathname.split('/').pop() ?? '';

    await chooseNewPassword(page, token);
    await expect(title(page, 'Your password is changed')).toBeVisible();
    await expectAccessibleOnceStill(page);

    await chooseNewPassword(page, token);
    await expectInvalidWithoutSchool(page);
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);
  });

  for (const [name, token] of Object.entries(badLinks('password_reset', null))) {
    test(`a reset link ${name} is refused without naming a school`, async ({ page }) => {
      await chooseNewPassword(page, token);
      await expectInvalidWithoutSchool(page);
    });
  }

  for (const [name, token] of Object.entries(badLinks('staff_invite', CIS_ID))) {
    test(`an invite link ${name} is refused without naming its school`, async ({ page }) => {
      await page.goto(`/sign-in/invite/${token}`);
      await expectInvalidWithoutSchool(page);
      const answer = await page.request.get(`/api/v1/auth/invites/${token}`);
      expect(answer.status()).toBe(400);
      const body = await answer.text();
      expect(JSON.parse(body)).toMatchObject({ code: 'invalid_link' });
      expect(body).not.toMatch(SCHOOL_NAMES);
    });
  }

  for (const [name, token] of Object.entries(badLinks('support_session', CIS_ID))) {
    test(`a support link ${name} is refused without naming its school`, async ({ page }) => {
      await page.goto(`/sign-in/support/${token}`);
      await expectInvalidWithoutSchool(page);
    });
  }

  test('an enquiry for an unknown embed key is refused with 404', async ({ page }) => {
    const answer = await page.request.post('/api/v1/public/enquiry/unknown-key', {
      data: { parentName: 'A parent', email: 'a.parent@example.com' },
    });
    expect(answer.status()).toBe(404);
    expect(await answer.text()).not.toMatch(SCHOOL_NAMES);
  });

  test.fixme('M7: a payment webhook with a bad signature is refused before any lookup', () => {
    // M7 builds the payment webhooks (spec 17 journey 43, "webhooks from M7").
  });
  test.fixme('M7: a signed webhook resolves its school through tenant_by_gateway_account, and a mismatched account id is refused', () => {
    // M7 builds the payment webhooks and `tenant_by_gateway_account`.
  });
});
