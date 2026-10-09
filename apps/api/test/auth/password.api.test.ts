import { ErrorBodySchema, Me, SignInResult } from '@quad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecordingDelivery } from '../fakes/delivery';
import { Browser, setCookie } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember, insertRole, insertSchool, setSchoolStatus } from '../helpers/identity';
import {
  anyText,
  auditRows,
  freshEmail,
  insertPasswordAccount,
  insertRoleWithKey,
  setSignInRules,
} from '../helpers/sign-in';

const T0 = Date.UTC(2026, 9, 8, 3, 30, 1);
let clock = T0;
const delivery = new RecordingDelivery();

const { db, app } = useDatabaseApp({}, { overrides: { now: () => clock, delivery } });

beforeEach(() => {
  clock = T0;
});

const signIn = (browser: Browser, body: object, url = '/auth/password') => browser.post(url, body);

describe('POST /auth/password (spec 05 step 3)', () => {
  it('opens the only school at once: next is done, and the session is active there', async () => {
    const school = await insertSchool(db(), { name: 'Colombo International School' });
    const account = await insertPasswordAccount(db());
    await insertMember(db(), school.id, account.id, { name: 'Prishan Maduka' });
    const browser = new Browser(app);

    const response = await signIn(browser, { email: account.email, password: account.password });

    expect(response.statusCode).toBe(200);
    expect(SignInResult.parse(response.json())).toEqual({ next: 'done' });
    const sid = setCookie(response, 'quad_sid');
    expect(sid).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    // Without Keep me signed in the cookie ends with the browser session.
    expect(sid?.maxAge).toBeUndefined();
    expect(setCookie(response, 'quad_csrf')?.httpOnly).toBeFalsy();
    const me = await browser.get('/me');
    expect(me.statusCode).toBe(200);
    expect(Me.parse(me.json()).school.id).toBe(school.id);
  });

  it('keeps the cookie for 30 days with Keep me signed in', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), school.id, account.id);
    const response = await signIn(new Browser(app), {
      email: account.email,
      password: account.password,
      keepSignedIn: true,
    });
    expect(setCookie(response, 'quad_sid')?.maxAge).toBe(30 * 24 * 60 * 60);
    expect(setCookie(response, 'quad_csrf')?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it('asks for a school with several staff memberships, and never picks one itself', async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), schoolA.id, account.id);
    await insertMember(db(), schoolB.id, account.id);
    const browser = new Browser(app);

    // `?school=` is only a hint for the page; the server ignores it.
    const response = await signIn(
      browser,
      { email: account.email, password: account.password },
      `/auth/password?school=${schoolA.id}`,
    );

    expect(response.json()).toEqual({ next: 'choose_school' });
    expect((await browser.get('/me')).statusCode).toBe(401);
    expect((await browser.get('/auth/memberships')).statusCode).toBe(200);
  });

  it('counts only staff memberships: a guardian membership elsewhere still opens the staff school', async () => {
    const staffSchool = await insertSchool(db());
    const familySchool = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), staffSchool.id, account.id);
    await insertMember(db(), familySchool.id, account.id, { kind: 'guardian' });
    const response = await signIn(new Browser(app), {
      email: account.email,
      password: account.password,
    });
    expect(response.json()).toEqual({ next: 'done' });
  });

  it('says there is no school for an account with no staff membership, and starts no session', async () => {
    const familySchool = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), familySchool.id, account.id, { kind: 'guardian' });
    const response = await signIn(new Browser(app), {
      email: account.email,
      password: account.password,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ next: 'no_school' });
    expect(setCookie(response, 'quad_sid')).toBeUndefined();
  });

  it('asks to set up two-step when a school requires it and there is no authenticator', async () => {
    const school = await insertSchool(db());
    await setSignInRules(db(), school.id, { twoStep: 'staff' });
    const account = await insertPasswordAccount(db());
    await insertMember(db(), school.id, account.id);
    const browser = new Browser(app);
    const response = await signIn(browser, { email: account.email, password: account.password });
    expect(response.json()).toEqual({ next: 'two_step_setup' });
    expect((await browser.get('/me')).statusCode).toBe(401);
  });

  it('asks for the code when the account has an authenticator', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db(), { totp: true });
    await insertMember(db(), school.id, account.id);
    const response = await signIn(new Browser(app), {
      email: account.email,
      password: account.password,
    });
    expect(response.json()).toEqual({ next: 'two_step' });
  });

  it('applies the strictest rule across schools: admins-only does not cover a teacher', async () => {
    const adminsOnly = await insertSchool(db());
    await setSignInRules(db(), adminsOnly.id, { twoStep: 'admins' });
    const teacher = await insertPasswordAccount(db());
    const teacherMember = await insertMember(db(), adminsOnly.id, teacher.id);
    await insertRoleWithKey(db(), adminsOnly.id, teacherMember, 'teacher', 'Teacher');
    expect(
      (await signIn(new Browser(app), { email: teacher.email, password: teacher.password })).json(),
    ).toEqual({ next: 'done' });

    const admin = await insertPasswordAccount(db());
    const adminMember = await insertMember(db(), adminsOnly.id, admin.id);
    await insertRoleWithKey(db(), adminsOnly.id, adminMember, 'admin', 'School admin');
    expect(
      (await signIn(new Browser(app), { email: admin.email, password: admin.password })).json(),
    ).toEqual({ next: 'two_step_setup' });
  });

  it('does not run the breached-password check on sign-in', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db(), { password: 'password123' });
    await insertMember(db(), school.id, account.id);
    const response = await signIn(new Browser(app), {
      email: account.email,
      password: 'password123',
    });
    expect(response.json()).toEqual({ next: 'done' });
  });

  it('answers 400 validation for a malformed body', async () => {
    const response = await signIn(new Browser(app), { email: 'nope', password: '' });
    expect(response.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(response.json())).toMatchObject({
      code: 'validation',
      fields: { email: anyText(), password: anyText() },
    });
  });

  it('gives a wrong password and an unknown email the same 401 invalid_credentials', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), school.id, account.id);

    const wrong = await signIn(new Browser(app), {
      email: account.email,
      password: 'not the password at all',
    });
    const unknown = await signIn(new Browser(app), {
      email: freshEmail(),
      password: 'not the password at all',
    });

    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toMatchObject({ code: 'invalid_credentials' });
    expect(unknown.body).toBe(wrong.body);
    expect(setCookie(wrong, 'quad_sid')).toBeUndefined();
  });

  it('answers 401 invalid_credentials for a disabled account, even with the right password', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db(), { status: 'disabled' });
    await insertMember(db(), school.id, account.id);
    const response = await signIn(new Browser(app), {
      email: account.email,
      password: account.password,
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'invalid_credentials' });
  });

  it('audits a failure in every school where the account is active staff (OQ11), and nowhere else', async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const familySchool = await insertSchool(db());
    const leftSchool = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    const inA = await insertMember(db(), schoolA.id, account.id);
    const inB = await insertMember(db(), schoolB.id, account.id);
    await insertMember(db(), familySchool.id, account.id, { kind: 'guardian' });
    await insertMember(db(), leftSchool.id, account.id, { status: 'deactivated' });
    const before = await auditRows(db(), 'auth.sign_in_failed');

    await signIn(new Browser(app), { email: account.email, password: 'wrong password here' });

    const rows = (await auditRows(db(), 'auth.sign_in_failed')).slice(before.length);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        { tenant_id: schoolA.id, actor_user_id: inA, target_id: account.id },
        { tenant_id: schoolB.id, actor_user_id: inB, target_id: account.id },
      ]),
    );
  });

  it('audits nothing for an unknown email', async () => {
    const before = await auditRows(db(), 'auth.sign_in_failed');
    await signIn(new Browser(app), { email: freshEmail(), password: 'wrong password here' });
    expect(await auditRows(db(), 'auth.sign_in_failed')).toHaveLength(before.length);
  });

  it("puts school A's session only in school A: the membership of A never reaches B", async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    const inA = await insertMember(db(), schoolA.id, account.id);
    await insertRole(db(), schoolA.id, inA, 'Teacher');
    const someoneInB = await insertPasswordAccount(db());
    await insertMember(db(), schoolB.id, someoneInB.id);
    const browser = new Browser(app);
    await signIn(browser, { email: account.email, password: account.password });
    const me = Me.parse((await browser.get('/me')).json());
    expect(me.school.id).toBe(schoolA.id);
    expect(me.memberships).toEqual([]);
  });

  it('shows a suspended only school in the list instead of opening it', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), school.id, account.id);
    await setSchoolStatus(db(), school.id, 'suspended');
    const browser = new Browser(app);
    const response = await signIn(browser, { email: account.email, password: account.password });
    expect(response.json()).toEqual({ next: 'choose_school' });
    expect((await browser.get('/me')).statusCode).toBe(401);
  });

  it('answers 429 after 10 tries in 15 minutes for one email, from any IP', async () => {
    const email = freshEmail();
    for (let call = 1; call <= 10; call += 1) {
      const response = await signIn(new Browser(app), { email, password: 'whatever it is' });
      expect(response.statusCode).toBe(401);
    }
    const refused = await signIn(new Browser(app), { email, password: 'whatever it is' });
    expect(refused.statusCode).toBe(429);
  });
});
