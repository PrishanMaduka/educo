import { randomBytes } from 'node:crypto';

import { expect, type APIRequestContext, type TestInfo } from '@playwright/test';
import { Mailpit, linkIn, tokenOf } from '@quad/config/playwright/mailpit';
import { STACK_FIXED_CODE } from '@quad/config/playwright/stack';

/*
 * New members of staff for the journeys that write (Task 26): each test invites its own person,
 * so parallel projects and retries never share or change a seeded one.
 */

/**
 * An address no other test, project, retry or run uses: `new.teacher+<run>-<project>-r<retry>`.
 * The run part (the time and 3 random bytes) keeps Mailpit's shared inbox apart between runs and
 * between repeats of one test (each run's database is fresh).
 */
export function inviteeAddress(testInfo: TestInfo, who = 'new.teacher'): string {
  const run = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
  return `${who}+${run}-${testInfo.project.name}-r${String(testInfo.retry)}@colombo-intl.local`;
}

async function csrfOf(request: APIRequestContext): Promise<string> {
  const { cookies } = await request.storageState();
  const token = cookies.find((cookie) => cookie.name === 'quad_csrf')?.value;
  if (token === undefined) throw new Error('The context has no CSRF cookie.');
  return token;
}

/** The id of the school's role with this name, as the admin sees `GET /roles`. */
export async function roleId(admin: APIRequestContext, name: string): Promise<string> {
  const response = await admin.get('/api/v1/roles');
  expect(response.ok()).toBe(true);
  const { items } = (await response.json()) as { items: { id: string; name: string }[] };
  const role = items.find((item) => item.name === name);
  if (role === undefined) throw new Error(`The school has no ${name} role.`);
  return role.id;
}

/** The invite link Mailpit received for `email` (an address of this test's own). */
export async function inviteLinkFor(email: string): Promise<string> {
  const message = await new Mailpit().waitForMessage({ to: email, subject: 'invited you' });
  const link = linkIn(message.text, '/sign-in/invite/');
  if (link === null) throw new Error(`The invite to ${email} has no invite link.`);
  return link;
}

/**
 * Invites `email` as `role` through the API as the admin whose context `admin` is, and accepts
 * it with `password` from a context of its own (as the invitee's browser would), so the person
 * has an active account. Two-step is left for their first sign-in.
 */
export async function createStaffMember(
  admin: APIRequestContext,
  invitee: APIRequestContext,
  { email, role, password }: { email: string; role: string; password: string },
): Promise<void> {
  const invited = await admin.post('/api/v1/users/invite', {
    data: { emails: [email], roleId: await roleId(admin, role) },
    headers: { 'x-csrf-token': await csrfOf(admin) },
  });
  expect(invited.status(), await invited.text()).toBe(201);
  const token = tokenOf(await inviteLinkFor(email));
  const accepted = await invitee.post(`/api/v1/auth/invites/${token}/accept`, {
    data: { password },
  });
  expect(accepted.status(), await accepted.text()).toBe(200);
}

/**
 * Turns on two-step for the person `invitee` just accepted an invite as (CIS asks staff for it),
 * as the set-up card does: `POST /me/totp` to start, then the stack's fixed code to confirm.
 */
export async function setUpTwoStep(invitee: APIRequestContext): Promise<void> {
  const headers = { 'x-csrf-token': await csrfOf(invitee) };
  const started = await invitee.post('/api/v1/me/totp', { data: {}, headers });
  expect(started.status(), await started.text()).toBe(200);
  const confirmed = await invitee.post('/api/v1/me/totp', {
    data: { code: STACK_FIXED_CODE },
    headers,
  });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
}
