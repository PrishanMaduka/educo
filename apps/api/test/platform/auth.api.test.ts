import {
  ErrorBodySchema,
  PlatformMe,
  PlatformSignInResult,
  PlatformTotpSetup,
} from '@quad/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PasswordHasher } from '../../src/common/crypto/passwords';
import { TotpCodes } from '../../src/common/crypto/totp';
import { InvalidCodeError } from '../../src/common/errors';
import { hashSessionToken } from '../../src/common/session/cookies';
import { CsrfTokens } from '../../src/common/session/csrf';
import { buildOpenApiDocument } from '../../src/openapi/document';
import { PlatformAuditService } from '../../src/platform/audit/platform-audit.service';
import { ConsoleSessions } from '../../src/platform/auth/console-sessions.service';
import { ConsoleSignInFailures } from '../../src/platform/auth/console-sign-in-failures';
import { PlatformAuthRepository } from '../../src/platform/auth/platform-auth.repository';
import { PlatformAuthService } from '../../src/platform/auth/platform-auth.service';
import { PLATFORM_DB } from '../../src/platform/tokens';
import { CONFIG, FIELD_CIPHER, REDIS } from '../../src/tokens';
import { RecordingDelivery } from '../fakes/delivery';
import { RecordingOtpSends } from '../fakes/otp-sends';
import { setCookie } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import {
  insertAccount,
  insertSchool,
  insertWebSession,
  sessionHeaders,
  signedInMember,
} from '../helpers/identity';
import { bearer, insertParentMember, insertPhoneAccount, signedInParent } from '../helpers/parent';
import {
  CONSOLE_CSRF,
  CONSOLE_SID,
  consoleBrowser,
  consoleTotpOf,
  insertConsoleUser,
  platformAuditRows,
  signInToConsole,
  totpCode,
} from '../helpers/platform';
import { freshEmail, malformedEmail } from '../helpers/sign-in';

import { PlatformProbeModule } from './probe.module';

import type { Config } from '../../src/config';
import type { ConsoleAuth } from '../../src/platform/auth/console-auth';
import type { Browser } from '../helpers/browser';
import type { ConsoleUser } from '../helpers/platform';
import type { FieldCipher, QuadPlatformDb } from '@quad/db';
import type { Redis } from 'ioredis';

const STEP = 30_000;
const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 9, 3, 30, 1);
let clock = T0;
const delivery = new RecordingDelivery();
const otpSends = new RecordingOtpSends(delivery);

const { db, app } = useDatabaseApp(
  {},
  {
    overrides: { now: () => clock, delivery, otpSends, testModules: [PlatformProbeModule] },
  },
);

beforeEach(() => {
  clock = T0;
});

const password = (browser: Browser, user: Pick<ConsoleUser, 'email' | 'password'>) =>
  browser.post('/platform/auth/password', { email: user.email, password: user.password });

/** A console user signed in with the password only: the session is at a sign-in step. */
async function atPasswordStep(
  options: Parameters<typeof insertConsoleUser>[1] = {},
): Promise<{ user: ConsoleUser; browser: Browser }> {
  const user = await insertConsoleUser(db(), options);
  const browser = consoleBrowser(app);
  const response = await password(browser, user);
  expect(response.statusCode).toBe(200);
  return { user, browser };
}

const secretOf = (user: ConsoleUser): string => {
  if (user.totpSecret === null) throw new Error('The console user has no authenticator.');
  return user.totpSecret;
};

/** A staff member's cookie and a parent's token, for the isolation checks. */
async function schoolCredentials() {
  const school = await insertSchool(db());
  const { session } = await signedInMember(db(), school);
  const parent = await insertPhoneAccount(db());
  await insertParentMember(db(), school.id, parent.id, 'guardian');
  const pair = await signedInParent(app, otpSends, parent.phone);
  return { session, accessToken: pair.accessToken };
}

describe('POST /platform/auth/password (spec 05 → Platform console)', () => {
  it('accepts the password of an active console user and asks for the authenticator code', async () => {
    const user = await insertConsoleUser(db());
    const browser = consoleBrowser(app);

    const response = await password(browser, user);

    expect(response.statusCode).toBe(200);
    expect(PlatformSignInResult.parse(response.json())).toEqual({ next: 'two_step' });
    expect(setCookie(response, CONSOLE_SID)).toMatchObject({
      httpOnly: true,
      // Strict: the console is never opened by a link from another site with its session.
      sameSite: 'Strict',
      path: '/',
    });
    expect(setCookie(response, CONSOLE_CSRF)).toMatchObject({ sameSite: 'Strict' });
    expect(setCookie(response, CONSOLE_CSRF)?.httpOnly).toBeFalsy();
    // Never the staff cookies.
    expect(setCookie(response, 'quad_sid')).toBeUndefined();
    expect(setCookie(response, 'quad_csrf')).toBeUndefined();
    const audit = await platformAuditRows(db(), 'auth.password_accepted', user.id);
    expect(audit).toEqual([
      expect.objectContaining({ actor_platform_user_id: user.id, target_type: 'platform_user' }),
    ]);
    expect(audit[0]?.ip).toBe(browser.ip);
  });

  it('asks a console user without an authenticator to set one up (first sign-in)', async () => {
    const user = await insertConsoleUser(db(), { totp: false });
    const response = await password(consoleBrowser(app), user);
    expect(response.json()).toEqual({ next: 'two_step_setup' });
  });

  it('answers 400 validation for a malformed email or a missing password, with no session', async () => {
    const browser = consoleBrowser(app);
    const bad = await browser.post('/platform/auth/password', {
      email: malformedEmail(),
      password: 'x',
    });
    const missing = await browser.post('/platform/auth/password', { email: freshEmail() });
    expect(bad.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(bad.json())).toMatchObject({ code: 'validation' });
    expect(bad.json()).toHaveProperty('fields.email');
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toHaveProperty('fields.password');
    expect(setCookie(bad, CONSOLE_SID)).toBeUndefined();
  });

  it('gives an unknown email, a deactivated user and a wrong password the same 401, and audits each', async () => {
    const wrongUser = await insertConsoleUser(db());
    const deactivated = await insertConsoleUser(db(), { status: 'disabled' });
    const unknownEmail = freshEmail('quad.test');

    const wrong = await password(consoleBrowser(app), { ...wrongUser, password: 'not it at all' });
    const disabled = await password(consoleBrowser(app), deactivated);
    const unknownBrowser = consoleBrowser(app);
    const unknown = await password(unknownBrowser, {
      email: unknownEmail,
      password: 'not it at all',
    });

    for (const response of [wrong, disabled, unknown]) {
      expect(response.statusCode).toBe(401);
      expect(response.body).toBe(wrong.body);
      expect(setCookie(response, CONSOLE_SID)).toBeUndefined();
    }
    expect(wrong.json()).toMatchObject({ code: 'invalid_credentials' });
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', wrongUser.id)).toEqual([
      expect.objectContaining({ actor_platform_user_id: null, meta: { reason: 'wrong_password' } }),
    ]);
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', deactivated.id)).toEqual([
      expect.objectContaining({ meta: { reason: 'deactivated' } }),
    ]);
    // The unknown email's failure is recorded (the positive control) with no actor and no target...
    const unknownRows = (await platformAuditRows(db(), 'auth.sign_in_failed', null)).filter(
      (row) => row.ip === unknownBrowser.ip,
    );
    expect(unknownRows).toEqual([
      {
        actor_platform_user_id: null,
        target_type: null,
        target_id: null,
        ip: unknownBrowser.ip,
        meta: { reason: 'unknown_email' },
      },
    ]);
    // ...and the email itself is nowhere in any row of the audit.
    const { rows } = await db().platform.query<{ count: string }>(
      `select count(*) from platform_audit a where a::text ilike '%' || $1 || '%'`,
      [unknownEmail],
    );
    expect(rows[0]?.count).toBe('0');
  });

  it('does the same work for an unknown email, a deactivated user and a wrong password before it answers', async () => {
    const known = await insertConsoleUser(db());
    const deactivated = await insertConsoleUser(db(), { status: 'disabled' });
    const repository = app().get(PlatformAuthRepository);
    const hasher = app().get(PasswordHasher);
    const audit = app().get(PlatformAuditService);
    const redis = app().get<Redis>(REDIS);
    const spies = {
      lookup: vi.spyOn(repository, 'userByEmail'),
      verify: vi.spyOn(hasher, 'verify'),
      verifyDummy: vi.spyOn(hasher, 'verifyDummy'),
      counterRead: vi.spyOn(redis, 'zcard'),
      counterWrite: vi.spyOn(redis, 'multi'),
      audit: vi.spyOn(audit, 'record'),
    };
    const work = async (email: string, typed: string) => {
      for (const spy of Object.values(spies)) spy.mockClear();
      const response = await password(consoleBrowser(app), { email, password: typed });
      expect(response.statusCode).toBe(401);
      return {
        lookups: spies.lookup.mock.calls.length,
        argon2Verifies: spies.verify.mock.calls.length + spies.verifyDummy.mock.calls.length,
        counterReads: spies.counterRead.mock.calls.length,
        counterWrites: spies.counterWrite.mock.calls.length,
        audits: spies.audit.mock.calls.length,
      };
    };
    try {
      const wrong = await work(known.email, 'not the password');
      expect(wrong).toEqual({
        lookups: 1,
        argon2Verifies: 1,
        counterReads: 1,
        counterWrites: 1,
        audits: 1,
      });
      expect(await work(freshEmail('quad.test'), 'not the password')).toEqual(wrong);
      expect(await work(deactivated.email, deactivated.password)).toEqual(wrong);
    } finally {
      for (const spy of Object.values(spies)) spy.mockRestore();
    }
  });

  it('never lets console user A’s password sign in as B', async () => {
    const a = await insertConsoleUser(db());
    const b = await insertConsoleUser(db());
    const browser = await signInToConsole(app, a, clock);

    const response = await password(browser, { email: b.email, password: 'a different one' });

    expect(response.statusCode).toBe(401);
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', b.id)).toHaveLength(1);
    // A's own session is untouched.
    expect(PlatformMe.parse((await browser.get('/platform/me')).json()).id).toBe(a.id);
  });

  it('locks the console user after five failures in 15 minutes (spec 05), even for the right password', async () => {
    const user = await insertConsoleUser(db());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      clock += 1000;
      const response = await password(consoleBrowser(app), { ...user, password: 'wrong' });
      expect(response.statusCode).toBe(401);
    }
    const locked = await password(consoleBrowser(app), user);
    expect(locked.statusCode).toBe(403);
    expect(locked.json()).toMatchObject({ code: 'account_locked' });
    const { rows } = await db().platform.query<{ locked_until: Date }>(
      'select locked_until from platform_users where id = $1',
      [user.id],
    );
    expect(rows[0]?.locked_until.getTime()).toBe(T0 + 5000 + 15 * 60 * 1000);

    clock = T0 + 5000 + 15 * 60 * 1000;
    expect((await password(consoleBrowser(app), user)).statusCode).toBe(200);
  });

  it('audits a password tried while the user is locked, and still answers 403', async () => {
    const user = await insertConsoleUser(db(), { lockedUntil: new Date(T0 + 60_000) });
    const response = await password(consoleBrowser(app), user);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'account_locked' });
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', user.id)).toEqual([
      expect.objectContaining({ actor_platform_user_id: null, meta: { reason: 'locked' } }),
    ]);
  });

  it('audits a failure it could not count, and still fails closed with 503', async () => {
    const user = await insertConsoleUser(db());
    const write = vi.spyOn(app().get<Redis>(REDIS), 'multi').mockImplementation(() => {
      throw new Error('Redis is down');
    });
    try {
      const response = await password(consoleBrowser(app), { ...user, password: 'wrong one' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: 'unavailable' });
    } finally {
      write.mockRestore();
    }
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', user.id)).toEqual([
      expect.objectContaining({ meta: { reason: 'unavailable' } }),
    ]);
  });

  it('fails closed with 503 unavailable when the lockout counter cannot be read', async () => {
    const user = await insertConsoleUser(db());
    const hasher = app().get(PasswordHasher);
    const read = vi.spyOn(app().get<Redis>(REDIS), 'zcard').mockRejectedValue(new Error('down'));
    const verify = vi.spyOn(hasher, 'verify');
    try {
      const response = await password(consoleBrowser(app), user);
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: 'unavailable' });
      expect(verify).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      verify.mockRestore();
    }
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', user.id)).toEqual([
      expect.objectContaining({ meta: { reason: 'unavailable' } }),
    ]);
  });

  it('revokes the console session this browser already had when it signs in again (M4)', async () => {
    const user = await insertConsoleUser(db());
    const browser = await signInToConsole(app, user, clock);
    const before = String(browser.cookies.get(CONSOLE_SID));
    const kept = browser.clone();

    expect((await password(browser, user)).statusCode).toBe(200);

    expect(browser.cookies.get(CONSOLE_SID)).not.toBe(before);
    expect((await kept.get('/platform/me')).statusCode).toBe(401);
    const { rows } = await db().platform.query<{ revoked: number }>(
      `select count(*)::int as revoked from sessions
       where platform_user_id = $1 and stage = 'active' and revoked_at is not null`,
      [user.id],
    );
    expect(rows[0]?.revoked).toBe(1);
    expect(await platformAuditRows(db(), 'auth.sign_out', user.id)).toEqual([
      expect.objectContaining({
        actor_platform_user_id: user.id,
        meta: { reason: 'signed_in_again' },
      }),
    ]);
  });

  it('revokes nothing when a password sent with an existing console cookie is wrong', async () => {
    const user = await insertConsoleUser(db());
    const browser = await signInToConsole(app, user, clock);

    const wrong = await password(browser, { ...user, password: 'not the password' });

    expect(wrong.statusCode).toBe(401);
    expect((await browser.get('/platform/me')).statusCode).toBe(200);
    expect(await platformAuditRows(db(), 'auth.sign_out', user.id)).toEqual([]);
  });

  it('never caches a sign-in answer (M3)', async () => {
    const user = await insertConsoleUser(db());
    const response = await password(consoleBrowser(app), user);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('counts in the shared per-IP sign-in bucket (20 a minute)', async () => {
    const browser = consoleBrowser(app);
    for (let request = 0; request < 20; request += 1) {
      const response = await browser.post('/platform/auth/password', {
        email: malformedEmail(),
        password: 'x',
      });
      expect(response.statusCode).toBe(400);
    }
    const refused = await browser.post('/platform/auth/password', {
      email: malformedEmail(),
      password: 'x',
    });
    expect(refused.statusCode).toBe(429);
  });
});

describe('POST /platform/auth/totp/verify', () => {
  it('opens the console with the authenticator code, on a new cookie', async () => {
    const { user, browser } = await atPasswordStep();
    const stepToken = browser.cookies.get(CONSOLE_SID);

    const response = await browser.post('/platform/auth/totp/verify', {
      code: await totpCode(secretOf(user), clock),
    });

    expect(response.statusCode).toBe(200);
    expect(PlatformSignInResult.parse(response.json())).toEqual({ next: 'done' });
    const token = setCookie(response, CONSOLE_SID)?.value;
    expect(token).toBeDefined();
    expect(token).not.toBe(stepToken);
    expect((await browser.get('/platform/me')).statusCode).toBe(200);
    // The password-step cookie is spent.
    const old = consoleBrowser(app);
    old.cookies.set(CONSOLE_SID, String(stepToken));
    expect((await old.get('/platform/me')).statusCode).toBe(401);
    expect(await platformAuditRows(db(), 'auth.sign_in', user.id)).toEqual([
      expect.objectContaining({ actor_platform_user_id: user.id }),
    ]);
  });

  it('answers 400 validation for a code that is not six digits', async () => {
    const { browser } = await atPasswordStep();
    const response = await browser.post('/platform/auth/totp/verify', { code: '12345' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
    expect(response.json()).toHaveProperty('fields.code');
  });

  it('answers 401 without a console session, or with a staff session at the code step', async () => {
    const accountId = await insertAccount(db());
    const staff = await insertWebSession(db(), accountId, { stage: 'two_step' });
    const none = await consoleBrowser(app).post('/platform/auth/totp/verify', { code: '123456' });
    const withStaff = await app()
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/platform/auth/totp/verify',
        headers: { ...sessionHeaders(staff), 'content-type': 'application/json' },
        payload: JSON.stringify({ code: '123456' }),
      });
    expect(none.statusCode).toBe(401);
    expect(withStaff.statusCode).toBe(401);
  });

  it('checks the code against A’s authenticator only: B’s code never opens A’s session', async () => {
    const a = await atPasswordStep();
    const b = await atPasswordStep();

    const response = await a.browser.post('/platform/auth/totp/verify', {
      code: await totpCode(secretOf(b.user), clock),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'invalid_code' });
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', a.user.id)).toEqual([
      expect.objectContaining({ meta: { reason: 'wrong_code' } }),
    ]);
    // B's own sign-in goes on.
    const own = await b.browser.post('/platform/auth/totp/verify', {
      code: await totpCode(secretOf(b.user), clock),
    });
    expect(own.json()).toEqual({ next: 'done' });
  });

  it('never accepts the same code twice (RFC 6238 §5.2)', async () => {
    const user = await insertConsoleUser(db());
    await signInToConsole(app, user, clock);
    const again = consoleBrowser(app);
    await password(again, user);
    const replay = await again.post('/platform/auth/totp/verify', {
      code: await totpCode(secretOf(user), clock),
    });
    expect(replay.statusCode).toBe(400);
    expect(replay.json()).toMatchObject({ code: 'invalid_code' });
    clock += STEP;
    const next = await again.post('/platform/auth/totp/verify', {
      code: await totpCode(secretOf(user), clock),
    });
    expect(next.json()).toEqual({ next: 'done' });
  });

  it('refuses a user deactivated between the password and the code', async () => {
    const { user, browser } = await atPasswordStep();
    await db().platform.query(`update platform_users set status = 'disabled' where id = $1`, [
      user.id,
    ]);
    const response = await browser.post('/platform/auth/totp/verify', {
      code: await totpCode(secretOf(user), clock),
    });
    expect(response.statusCode).toBe(401);
    // A second try with the same step session: refused again, but audited only once, because
    // the refusal ended the session.
    const again = await browser.post('/platform/auth/totp/verify', { code: '123456' });
    expect(again.statusCode).toBe(401);
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', user.id)).toEqual([
      expect.objectContaining({ actor_platform_user_id: null, meta: { reason: 'deactivated' } }),
    ]);
    const { rows } = await db().platform.query<{ revoked: boolean }>(
      'select revoked_at is not null as revoked from sessions where platform_user_id = $1',
      [user.id],
    );
    expect(rows).toEqual([{ revoked: true }]);
  });

  it('treats an expired step session as signed out, before it looks at the user', async () => {
    const expired = await atPasswordStep();
    const live = await atPasswordStep();
    for (const user of [expired.user, live.user]) {
      await db().platform.query(`update platform_users set status = 'disabled' where id = $1`, [
        user.id,
      ]);
    }
    // The live session is the positive control: it is audited as deactivated.
    expect(
      (await live.browser.post('/platform/auth/totp/verify', { code: '123456' })).statusCode,
    ).toBe(401);
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', live.user.id)).toHaveLength(1);
    clock += 15 * 60 * 1000;
    expect(
      (await expired.browser.post('/platform/auth/totp/verify', { code: '123456' })).statusCode,
    ).toBe(401);
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', expired.user.id)).toEqual([]);
  });

  it('locks the user after five wrong codes (403 next, locked_until set), and audits the code tried while locked', async () => {
    const { user, browser } = await atPasswordStep();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      clock += 1000;
      const wrong = await browser.post('/platform/auth/totp/verify', { code: '000001' });
      expect(wrong.statusCode).toBe(400);
    }
    const locked = await browser.post('/platform/auth/totp/verify', {
      code: await totpCode(secretOf(user), clock),
    });
    expect(locked.statusCode).toBe(403);
    expect(locked.json()).toMatchObject({ code: 'account_locked' });
    const { rows } = await db().platform.query<{ locked_until: Date | null }>(
      'select locked_until from platform_users where id = $1',
      [user.id],
    );
    expect(rows[0]?.locked_until?.getTime()).toBe(T0 + 5000 + 15 * 60 * 1000);
    const reasons = (await platformAuditRows(db(), 'auth.sign_in_failed', user.id)).map(
      (row) => row.meta.reason,
    );
    expect(reasons).toEqual([
      'wrong_code',
      'wrong_code',
      'wrong_code',
      'wrong_code',
      'wrong_code',
      'locked',
    ]);
  });

  it('fails closed with 503 when the counter cannot be read, before the code is decrypted or checked', async () => {
    const { user, browser } = await atPasswordStep();
    const cipher = app().get<FieldCipher>(FIELD_CIPHER);
    const spies = {
      read: vi.spyOn(app().get<Redis>(REDIS), 'zcard').mockRejectedValue(new Error('down')),
      decrypt: vi.spyOn(cipher, 'decrypt'),
      match: vi.spyOn(app().get(TotpCodes), 'match'),
    };
    try {
      const response = await browser.post('/platform/auth/totp/verify', {
        code: await totpCode(secretOf(user), clock),
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: 'unavailable' });
      expect(spies.decrypt).not.toHaveBeenCalled();
      expect(spies.match).not.toHaveBeenCalled();
    } finally {
      for (const spy of Object.values(spies)) spy.mockRestore();
    }
    expect(await platformAuditRows(db(), 'auth.sign_in_failed', user.id)).toEqual([
      expect.objectContaining({ meta: { reason: 'unavailable' } }),
    ]);
  });

  it('refuses the local fixed code when DEV_FIXED_OTP is not set', async () => {
    const { browser } = await atPasswordStep();
    const response = await browser.post('/platform/auth/totp/verify', { code: '000000' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'invalid_code' });
  });

  it('ends the code step after 15 minutes', async () => {
    const { user, browser } = await atPasswordStep();
    clock += 15 * 60 * 1000;
    const response = await browser.post('/platform/auth/totp/verify', {
      code: await totpCode(secretOf(user), clock),
    });
    expect(response.statusCode).toBe(401);
  });

  it('needs the console CSRF token', async () => {
    const { user, browser } = await atPasswordStep();
    const response = await browser.post(
      '/platform/auth/totp/verify',
      { code: await totpCode(secretOf(user), clock) },
      { csrf: false },
    );
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
  });
});

describe('POST /platform/auth/totp/setup (TOTP is mandatory, spec 07)', () => {
  it('gives a new authenticator once, stores it sealed, and the first code turns it on', async () => {
    const { user, browser } = await atPasswordStep({ totp: false });

    const response = await browser.post('/platform/auth/totp/setup');

    expect(response.statusCode).toBe(200);
    const setup = PlatformTotpSetup.parse(response.json());
    expect(setup.otpauthUri).toContain(`secret=${setup.secret}`);
    const stored = await consoleTotpOf(db(), user.id);
    expect(stored).toMatchObject({ totpEnabled: false, secret: setup.secret });
    expect(stored.sealed).not.toContain(setup.secret);
    expect(await platformAuditRows(db(), 'auth.two_step_setup_started', user.id)).toHaveLength(1);
    // Nothing else is reachable until the authenticator is on.
    expect((await browser.get('/platform/me')).statusCode).toBe(401);

    const verify = await browser.post('/platform/auth/totp/verify', {
      code: await totpCode(setup.secret, clock),
    });

    expect(verify.json()).toEqual({ next: 'done' });
    expect((await consoleTotpOf(db(), user.id)).totpEnabled).toBe(true);
    expect(await platformAuditRows(db(), 'auth.two_step_enabled', user.id)).toHaveLength(1);
    expect(await platformAuditRows(db(), 'auth.sign_in', user.id)).toHaveLength(1);
    expect((await browser.get('/platform/me')).statusCode).toBe(200);
    // The secret is never logged in the audit.
    const { rows } = await db().platform.query<{ count: string }>(
      `select count(*) from platform_audit where meta::text like '%' || $1 || '%'`,
      [setup.secret],
    );
    expect(rows[0]?.count).toBe('0');
  });

  it('replaces an authenticator that was never confirmed: only the newest secret works', async () => {
    const { browser } = await atPasswordStep({ totp: false });
    const first = PlatformTotpSetup.parse((await browser.post('/platform/auth/totp/setup')).json());
    const second = PlatformTotpSetup.parse(
      (await browser.post('/platform/auth/totp/setup')).json(),
    );
    expect(second.secret).not.toBe(first.secret);
    const stale = await browser.post('/platform/auth/totp/verify', {
      code: await totpCode(first.secret, clock),
    });
    expect(stale.json()).toMatchObject({ code: 'invalid_code' });
  });

  it('answers 409 when the authenticator was turned on from another tab', async () => {
    const { user, browser } = await atPasswordStep({ totp: false });
    const other = browser.clone();
    const setup = PlatformTotpSetup.parse((await other.post('/platform/auth/totp/setup')).json());
    await db().platform.query('update platform_users set totp_enabled = true where id = $1', [
      user.id,
    ]);
    const response = await browser.post('/platform/auth/totp/setup');
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'conflict' });
    // The secret that was turned on is kept.
    expect((await consoleTotpOf(db(), user.id)).secret).toBe(setup.secret);
  });

  it('never lets the secret be cached (M3)', async () => {
    const { browser } = await atPasswordStep({ totp: false });
    const response = await browser.post('/platform/auth/totp/setup');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('answers 400 validation for a body with anything in it', async () => {
    const { browser } = await atPasswordStep({ totp: false });
    const response = await browser.post('/platform/auth/totp/setup', { code: '123456' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('answers 401 without a session, at the code step, and once signed in', async () => {
    const withAuthenticator = await atPasswordStep();
    const signedIn = await signInToConsole(app, await insertConsoleUser(db()), clock);
    expect((await consoleBrowser(app).post('/platform/auth/totp/setup')).statusCode).toBe(401);
    expect((await withAuthenticator.browser.post('/platform/auth/totp/setup')).statusCode).toBe(
      401,
    );
    expect((await signedIn.post('/platform/auth/totp/setup')).statusCode).toBe(401);
  });

  it('sets up A’s authenticator only: B’s stays as it was', async () => {
    const a = await atPasswordStep({ totp: false });
    const b = await atPasswordStep({ totp: false });
    await a.browser.post('/platform/auth/totp/setup');
    expect((await consoleTotpOf(db(), a.user.id)).sealed).not.toBeNull();
    expect(await consoleTotpOf(db(), b.user.id)).toEqual({
      totpEnabled: false,
      sealed: null,
      secret: null,
    });
  });
});

describe('POST /platform/auth/sign-out', () => {
  it('ends the console session and clears its cookies', async () => {
    const user = await insertConsoleUser(db());
    const browser = await signInToConsole(app, user, clock);
    const kept = browser.clone();

    const response = await browser.post('/platform/auth/sign-out');

    expect(response.statusCode).toBe(204);
    expect(setCookie(response, CONSOLE_SID)?.value).toBe('');
    expect(setCookie(response, CONSOLE_CSRF)?.value).toBe('');
    expect((await kept.get('/platform/me')).statusCode).toBe(401);
    expect(await platformAuditRows(db(), 'auth.sign_out', user.id)).toEqual([
      expect.objectContaining({ actor_platform_user_id: user.id }),
    ]);
  });

  it('signs out at a sign-in step too', async () => {
    const { browser } = await atPasswordStep({ totp: false });
    expect((await browser.post('/platform/auth/sign-out')).statusCode).toBe(204);
  });

  it('answers 400 validation for a body with anything in it', async () => {
    const browser = await signInToConsole(app, await insertConsoleUser(db()), clock);
    const response = await browser.post('/platform/auth/sign-out', { everywhere: true });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('answers 401 without a console session, and 403 without the CSRF token', async () => {
    const browser = await signInToConsole(app, await insertConsoleUser(db()), clock);
    expect((await consoleBrowser(app).post('/platform/auth/sign-out')).statusCode).toBe(401);
    const noCsrf = await browser.post('/platform/auth/sign-out', undefined, { csrf: false });
    expect(noCsrf.statusCode).toBe(403);
    expect((await browser.get('/platform/me')).statusCode).toBe(200);
  });

  it('signs out only A: B’s console session goes on', async () => {
    const a = await signInToConsole(app, await insertConsoleUser(db()), clock);
    const userB = await insertConsoleUser(db());
    const b = await signInToConsole(app, userB, clock);
    expect((await a.post('/platform/auth/sign-out')).statusCode).toBe(204);
    const me = await b.get('/platform/me');
    expect(me.statusCode).toBe(200);
    expect(PlatformMe.parse(me.json()).id).toBe(userB.id);
  });
});

describe('GET /platform/me', () => {
  it('is the signed-in console user’s name and role', async () => {
    const user = await insertConsoleUser(db(), { role: 'support', name: 'Ruwan Mendis' });
    const browser = await signInToConsole(app, user, clock);
    const response = await browser.get('/platform/me');
    expect(response.statusCode).toBe(200);
    expect(PlatformMe.parse(response.json())).toEqual({
      id: user.id,
      name: 'Ruwan Mendis',
      role: 'support',
    });
  });

  it('answers 400 validation for a query it does not take', async () => {
    const browser = await signInToConsole(app, await insertConsoleUser(db()), clock);
    const response = await browser.get('/platform/me?userId=someone');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('answers 401 without a session, at a sign-in step, after 8 hours idle and once deactivated', async () => {
    const user = await insertConsoleUser(db());
    const browser = await signInToConsole(app, user, clock);
    const step = await atPasswordStep();
    expect((await consoleBrowser(app).get('/platform/me')).statusCode).toBe(401);
    expect((await step.browser.get('/platform/me')).statusCode).toBe(401);

    // Activity keeps it open (8 hours idle, not 8 hours in all)...
    clock += 6 * HOUR;
    expect((await browser.get('/platform/me')).statusCode).toBe(200);
    clock += 6 * HOUR;
    expect((await browser.get('/platform/me')).statusCode).toBe(200);
    // ...and 8 hours without any ends it.
    clock += 8 * HOUR;
    expect((await browser.get('/platform/me')).statusCode).toBe(401);

    const other = await insertConsoleUser(db());
    const signedIn = await signInToConsole(app, other, clock);
    await db().platform.query(`update platform_users set status = 'disabled' where id = $1`, [
      other.id,
    ]);
    expect((await signedIn.get('/platform/me')).statusCode).toBe(401);
  });

  it('answers as A for A’s cookie and as B for B’s', async () => {
    const userA = await insertConsoleUser(db());
    const userB = await insertConsoleUser(db());
    const a = await signInToConsole(app, userA, clock);
    const b = await signInToConsole(app, userB, clock);
    expect(PlatformMe.parse((await a.get('/platform/me')).json()).id).toBe(userA.id);
    expect(PlatformMe.parse((await b.get('/platform/me')).json()).id).toBe(userB.id);
  });
});

describe('cookie isolation (D28 ruling R-console-realtime)', () => {
  const inject = (method: 'GET' | 'POST', url: string, headers: Record<string, string>) =>
    app()
      .getHttpAdapter()
      .getInstance()
      .inject({ method, url: `/api/v1${url}`, headers });

  it('never authenticates /platform with a staff quad_sid or a parent bearer token', async () => {
    const { session, accessToken } = await schoolCredentials();
    for (const headers of [sessionHeaders(session), bearer(accessToken)]) {
      expect((await inject('GET', '/platform/me', headers)).statusCode).toBe(401);
      expect((await inject('POST', '/platform/auth/sign-out', headers)).statusCode).toBe(401);
    }
    // A staff token under the console cookie's name is no console session either.
    const smuggled = { cookie: `${CONSOLE_SID}=${session.token}`, 'x-csrf-token': session.csrf };
    expect((await inject('GET', '/platform/me', smuggled)).statusCode).toBe(401);
  });

  it('never authenticates /auth or /me with a console cookie, under either name', async () => {
    const browser = await signInToConsole(app, await insertConsoleUser(db()), clock);
    const token = String(browser.cookies.get(CONSOLE_SID));
    const csrf = String(browser.cookies.get(CONSOLE_CSRF));
    for (const cookie of [`${CONSOLE_SID}=${token}`, `quad_sid=${token}`]) {
      const headers = { cookie, 'x-csrf-token': csrf };
      expect((await inject('GET', '/me', headers)).statusCode).toBe(401);
      expect((await inject('GET', '/me/sessions', headers)).statusCode).toBe(401);
      expect((await inject('GET', '/auth/memberships', headers)).statusCode).toBe(401);
      expect((await inject('POST', '/auth/sign-out', headers)).statusCode).toBe(401);
    }
    // Still a console session (the positive control).
    expect((await browser.get('/platform/me')).statusCode).toBe(200);
  });
});

describe('@PlatformRole (spec 05 → Platform roles; deny by default)', () => {
  it('refuses a readonly user with 403 on an owner-only route, and lets the owner in', async () => {
    const readonly = await signInToConsole(
      app,
      await insertConsoleUser(db(), { role: 'readonly' }),
      clock,
    );
    const owner = await signInToConsole(app, await insertConsoleUser(db()), clock);
    const refused = await readonly.get('/platform/probe/owner');
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'forbidden' });
    expect((await owner.get('/platform/probe/owner')).statusCode).toBe(200);
  });

  it('answers 401 on a role route at a sign-in step', async () => {
    const { browser } = await atPasswordStep({ totp: false });
    expect((await browser.get('/platform/probe/owner')).statusCode).toBe(401);
  });
});

describe('the console routes in the API description (M13)', () => {
  it('declares the empty request bodies of totp/setup and sign-out', () => {
    const document = buildOpenApiDocument();
    for (const path of ['/api/v1/platform/auth/totp/setup', '/api/v1/platform/auth/sign-out']) {
      expect(document.paths?.[path]?.post?.requestBody).toMatchObject({
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/PlatformNoInput' } },
        },
      });
    }
  });
});

describe('DEV_FIXED_OTP on the console (local only, D32)', () => {
  const fixed = useDatabaseApp({ DEV_FIXED_OTP: '000000' }, { overrides: { now: () => clock } });

  /** The same service as the app's, but configured as staging (the app cannot boot as staging here). */
  function serviceAs(appEnv: Config['APP_ENV']): PlatformAuthService {
    const made = fixed.app();
    const config = { ...made.get<Config>(CONFIG), APP_ENV: appEnv };
    return new PlatformAuthService(
      made.get<QuadPlatformDb>(PLATFORM_DB),
      made.get(PlatformAuthRepository),
      made.get(PlatformAuditService),
      made.get(ConsoleSignInFailures),
      made.get(PasswordHasher),
      made.get(TotpCodes),
      made.get(CsrfTokens),
      made.get<FieldCipher>(FIELD_CIPHER),
      config,
      () => clock,
    );
  }

  /** A console user at the code step on the fixed-code app, and their session. */
  async function codeStep(): Promise<ConsoleAuth> {
    const user = await insertConsoleUser(fixed.db());
    const browser = consoleBrowser(fixed.app);
    expect((await password(browser, user)).json()).toEqual({ next: 'two_step' });
    const auth = await fixed
      .app()
      .get(ConsoleSessions)
      .authenticate(hashSessionToken(String(browser.cookies.get(CONSOLE_SID))));
    if (auth === null) throw new Error('No console session.');
    return auth;
  }

  it('refuses the fixed code with APP_ENV=staging, even though DEV_FIXED_OTP is set', async () => {
    const client = { ip: '10.0.0.1', userAgent: null };
    await expect(
      serviceAs('staging').verifyTotp(await codeStep(), { code: '000000' }, client),
    ).rejects.toBeInstanceOf(InvalidCodeError);
    // The positive control: the same call configured as local opens the console.
    await expect(
      serviceAs('local').verifyTotp(await codeStep(), { code: '000000' }, client),
    ).resolves.toMatchObject({ next: 'done' });
  });

  it('opens the console with the fixed code at the code step', async () => {
    const user = await insertConsoleUser(fixed.db());
    const browser = consoleBrowser(fixed.app);
    expect((await password(browser, user)).json()).toEqual({ next: 'two_step' });
    const response = await browser.post('/platform/auth/totp/verify', { code: '000000' });
    expect(response.json()).toEqual({ next: 'done' });
  });

  it('turns a new authenticator on with the fixed code at set-up', async () => {
    const user = await insertConsoleUser(fixed.db(), { totp: false });
    const browser = consoleBrowser(fixed.app);
    expect((await password(browser, user)).json()).toEqual({ next: 'two_step_setup' });
    expect((await browser.post('/platform/auth/totp/setup')).statusCode).toBe(200);
    const response = await browser.post('/platform/auth/totp/verify', { code: '000000' });
    expect(response.json()).toEqual({ next: 'done' });
    expect((await consoleTotpOf(fixed.db(), user.id)).totpEnabled).toBe(true);
  });
});
