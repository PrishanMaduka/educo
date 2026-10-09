import { Me } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { Browser, setCookie } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import {
  insertAccount,
  insertMember,
  insertSchool,
  insertWebSession,
  setSchoolStatus,
} from '../helpers/identity';
import { anyText, auditRows, insertPasswordAccount, textContaining } from '../helpers/sign-in';

import type { SchoolSeed } from '../helpers/identity';
import type { PasswordAccount } from '../helpers/sign-in';

const NOW = Date.UTC(2026, 9, 8, 3, 30, 1);
const { db, app } = useDatabaseApp({}, { overrides: { now: () => NOW } });

/** A staff member of two schools (or more), signed in with the password: stage choose_school. */
async function choosing(
  extra: (account: PasswordAccount) => Promise<void> = () => Promise.resolve(),
): Promise<{
  account: PasswordAccount;
  a: SchoolSeed;
  b: SchoolSeed;
  userA: string;
  browser: Browser;
}> {
  const a = await insertSchool(db(), { name: 'Colombo International School' });
  const b = await insertSchool(db(), { name: 'Kandy Hills College' });
  const account = await insertPasswordAccount(db());
  const userA = await insertMember(db(), a.id, account.id);
  await insertMember(db(), b.id, account.id);
  await extra(account);
  const browser = new Browser(app);
  const response = await browser.post('/auth/password', {
    email: account.email,
    password: account.password,
  });
  expect(response.json()).toEqual({ next: 'choose_school' });
  return { account, a, b, userA, browser };
}

const select = (browser: Browser, body: object, query = '') =>
  browser.post(`/auth/select-school${query}`, body);

/** The session row behind a browser's cookie. */
async function sessionOf(browser: Browser) {
  const { rows } = await db().platform.query<{
    stage: string;
    active_tenant_id: string | null;
    active_user_id: string | null;
  }>(
    `select stage, active_tenant_id, active_user_id from sessions
     where token_hash = sha256(convert_to($1, 'UTF8'))`,
    [browser.cookies.get('quad_sid') ?? ''],
  );
  return rows[0];
}

describe('POST /auth/select-school (spec 05 step 5)', () => {
  it('opens the chosen school with a new session token, and audits the sign-in there', async () => {
    const { a, userA, browser } = await choosing();
    const oldCookie = browser.cookies.get('quad_sid') ?? '';
    const stale = browser.clone();

    const response = await select(browser, { tenantId: a.id });

    expect(response.statusCode).toBe(204);
    expect(browser.cookies.get('quad_sid')).not.toBe(oldCookie);
    const me = await browser.get('/me');
    expect(me.statusCode).toBe(200);
    expect(Me.parse(me.json()).school.id).toBe(a.id);
    // The old token is gone (rotated, spec 05).
    expect((await stale.get('/auth/memberships')).statusCode).toBe(401);
    expect(await sessionOf(browser)).toEqual({
      stage: 'active',
      active_tenant_id: a.id,
      active_user_id: userA,
    });
    const audits = (await auditRows(db(), 'auth.sign_in')).filter((row) => row.tenant_id === a.id);
    expect(audits).toEqual([{ tenant_id: a.id, actor_user_id: userA, target_id: userA }]);
  });

  it('refuses a school the account is not a member of with 403, and the session keeps no school (Accept)', async () => {
    const { browser } = await choosing();
    const stranger = await insertSchool(db());
    const cookie = browser.cookies.get('quad_sid');

    const response = await select(browser, { tenantId: stranger.id });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
    expect(browser.cookies.get('quad_sid')).toBe(cookie);
    expect(await sessionOf(browser)).toEqual({
      stage: 'choose_school',
      active_tenant_id: null,
      active_user_id: null,
    });
    expect((await browser.get('/me')).statusCode).toBe(401);
  });

  it('refuses a deactivated membership with 403', async () => {
    const left = await insertSchool(db());
    const { browser } = await choosing(async (account) => {
      await insertMember(db(), left.id, account.id, { status: 'deactivated' });
    });
    expect((await select(browser, { tenantId: left.id })).statusCode).toBe(403);
    expect((await sessionOf(browser))?.active_tenant_id).toBeNull();
  });

  it('refuses a suspended school with 403 school_suspended and the reason', async () => {
    const paused = await insertSchool(db(), { suspendReason: 'The subscription is unpaid.' });
    await setSchoolStatus(db(), paused.id, 'suspended');
    const { browser } = await choosing(async (account) => {
      await insertMember(db(), paused.id, account.id);
    });
    const response = await select(browser, { tenantId: paused.id });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: 'school_suspended',
      message: textContaining('The subscription is unpaid.'),
    });
    expect((await sessionOf(browser))?.active_tenant_id).toBeNull();
  });

  it('refuses a guardian-only membership with 403 (the staff cookie takes staff memberships only)', async () => {
    const family = await insertSchool(db());
    const { browser } = await choosing(async (account) => {
      await insertMember(db(), family.id, account.id, { kind: 'guardian' });
    });
    const response = await select(browser, { tenantId: family.id });
    expect(response.statusCode).toBe(403);
    expect((await sessionOf(browser))?.active_tenant_id).toBeNull();
  });

  it("never selects another account's membership: account X in a school where only Y is a member gets 403", async () => {
    const { browser } = await choosing();
    const ySchool = await insertSchool(db());
    const y = await insertAccount(db());
    await insertMember(db(), ySchool.id, y);
    expect((await select(browser, { tenantId: ySchool.id })).statusCode).toBe(403);
  });

  it('puts X on their own membership when X and Y are both members of the school', async () => {
    const shared = await insertSchool(db());
    const y = await insertAccount(db());
    const yUser = await insertMember(db(), shared.id, y);
    let xUser = '';
    const { browser } = await choosing(async (account) => {
      xUser = await insertMember(db(), shared.id, account.id);
    });
    expect((await select(browser, { tenantId: shared.id })).statusCode).toBe(204);
    const row = await sessionOf(browser);
    expect(row?.active_user_id).toBe(xUser);
    expect(row?.active_user_id).not.toBe(yUser);
  });

  it('never selects from ?school= alone: without tenantId in the body it is 400', async () => {
    const { a, browser } = await choosing();
    const response = await select(browser, {}, `?school=${a.id}`);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation',
      fields: { tenantId: anyText() },
    });
    expect((await sessionOf(browser))?.active_tenant_id).toBeNull();
  });

  it('answers 400 validation for a tenantId that is not an id', async () => {
    const { browser } = await choosing();
    const response = await select(browser, { tenantId: 'colombo-intl' });
    expect(response.statusCode).toBe(400);
  });

  it('answers 401 without a session, and at stage two_step', async () => {
    const school = await insertSchool(db());
    expect((await select(new Browser(app), { tenantId: school.id })).statusCode).toBe(401);
    const account = await insertPasswordAccount(db(), { totp: true });
    await insertMember(db(), school.id, account.id);
    const browser = new Browser(app);
    await browser.post('/auth/password', { email: account.email, password: account.password });
    expect((await select(browser, { tenantId: school.id })).statusCode).toBe(401);
  });

  it('remembers the school on the device with a non-sensitive quad_last_school cookie', async () => {
    const { a, browser } = await choosing();
    const response = await select(browser, { tenantId: a.id, remember: true });
    const remembered = setCookie(response, 'quad_last_school');
    expect(remembered).toBeDefined();
    expect(remembered?.httpOnly).toBeFalsy();
    expect(JSON.parse(decodeURIComponent(remembered?.value ?? ''))).toEqual({
      name: 'Colombo International School',
      logoUrl: null,
    });
    expect(remembered?.value).not.toContain(a.id);
  });

  it('forgets the remembered school when remember is off', async () => {
    const { a, browser } = await choosing();
    browser.cookies.set('quad_last_school', 'x');
    const response = await select(browser, { tenantId: a.id, remember: false });
    expect(browser.cookies.has('quad_last_school')).toBe(false);
    expect(setCookie(response, 'quad_last_school')).toBeDefined();
  });

  it('switches school from an active session: it re-checks the membership and rotates the token', async () => {
    const { a, b, browser } = await choosing();
    await select(browser, { tenantId: a.id });
    const inA = browser.cookies.get('quad_sid');
    const response = await select(browser, { tenantId: b.id });
    expect(response.statusCode).toBe(204);
    expect(browser.cookies.get('quad_sid')).not.toBe(inA);
    expect(Me.parse((await browser.get('/me')).json()).school.id).toBe(b.id);
    const stranger = await insertSchool(db());
    expect((await select(browser, { tenantId: stranger.id })).statusCode).toBe(403);
    // A refused switch leaves the person where they were.
    expect(Me.parse((await browser.get('/me')).json()).school.id).toBe(b.id);
  });

  it('answers 403 without the CSRF header', async () => {
    const { a, browser } = await choosing();
    expect(
      (await browser.post('/auth/select-school', { tenantId: a.id }, { csrf: false })).statusCode,
    ).toBe(403);
  });

  it("refuses a session's school from A reaching B: a member of A only cannot switch into B", async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const account = await insertAccount(db());
    const userA = await insertMember(db(), schoolA.id, account);
    const session = await insertWebSession(db(), account, { tenantId: schoolA.id, userId: userA });
    const browser = new Browser(app);
    browser.cookies.set('quad_sid', session.token);
    browser.cookies.set('quad_csrf', session.csrf);
    expect((await select(browser, { tenantId: schoolB.id })).statusCode).toBe(403);
    expect(Me.parse((await browser.get('/me')).json()).school.id).toBe(schoolA.id);
  });
});
