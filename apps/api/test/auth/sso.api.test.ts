import { randomBytes } from 'node:crypto';

import { Me, SignInMembershipList, SsoStartResult } from '@quad/contracts';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRepository } from '../../src/modules/auth/auth.repository';
import { lockoutKey } from '../../src/modules/auth/lockout.service';
import { TENANT_DB } from '../../src/tokens';
import { captureLogs } from '../app';
import { fakeSubjectFor, startFakeOidcIssuer } from '../fakes/oidc-issuer';
import { Browser, setCookie } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember, insertSchool } from '../helpers/identity';
import {
  auditRows,
  freshEmail,
  insertPasswordAccount,
  malformedEmail,
  setSignInRules,
  totpCode,
} from '../helpers/sign-in';

import type { FakeOidcIssuer, FakeSignIn } from '../fakes/oidc-issuer';
import type { SchoolSeed } from '../helpers/identity';
import type { PasswordAccount } from '../helpers/sign-in';
import type { SsoProvider, SsoSignInError, TenantStatus, TwoStepRule } from '@quad/contracts';
import type { QuadTenantDb } from '@quad/db';
import type { LightMyRequestResponse as Response } from 'fastify';

/**
 * Staff SSO (spec 05 step 2; Task 8): OIDC with PKCE, state and nonce, against the fake issuer
 * only (D32). The school comes from the account's own memberships, never from the provider. The
 * callback always redirects: to the next sign-in step, or back to `/sign-in?error=<code>`.
 */

const NOW = Date.UTC(2026, 9, 8, 3, 30, 1);
const MINUTE_MS = 60 * 1000;
const WEB = 'http://localhost:3000';
const STATE_COOKIE = 'quad_sso';

let clock = NOW;
let issuer: FakeOidcIssuer | undefined;
const fake = (): FakeOidcIssuer => {
  if (issuer === undefined) throw new Error('The fake issuer is not running.');
  return issuer;
};
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

beforeAll(async () => {
  issuer = await startFakeOidcIssuer();
});
afterAll(async () => {
  await issuer?.close();
  await redis.quit();
});

/** Every log line of the app, and every error it reports to error tracking. */
const logs = captureLogs();
const reported: unknown[] = [];

const { db, app } = useDatabaseApp(() => ({ OIDC_FAKE_ISSUER_URL: fake().url }), {
  overrides: { now: () => clock },
  logger: logs.logger,
  reporter: {
    capture: (error) => {
      reported.push(error);
      return undefined;
    },
    flush: () => Promise.resolve(true),
  },
});

beforeEach(() => {
  clock = NOW;
});

/** A school with SSO for one provider on a fresh domain. */
async function ssoSchool(
  options: {
    readonly provider?: SsoProvider;
    readonly twoStep?: TwoStepRule;
    readonly status?: TenantStatus;
    readonly suspendReason?: string;
  } = {},
): Promise<{ school: SchoolSeed; domain: string }> {
  const domain = `school-${randomBytes(4).toString('hex')}.test`;
  const school = await insertSchool(db(), {
    ...(options.status === undefined ? {} : { status: options.status }),
    ...(options.suspendReason === undefined ? {} : { suspendReason: options.suspendReason }),
  });
  const provider = options.provider ?? 'google';
  await setSignInRules(db(), school.id, {
    ssoDomain: domain,
    ssoGoogle: provider === 'google',
    ssoMicrosoft: provider === 'microsoft',
    ...(options.twoStep === undefined ? {} : { twoStep: options.twoStep }),
  });
  return { school, domain };
}

/** An active staff member of `school` whose work email is at `domain`. */
async function staffAt(
  school: SchoolSeed,
  domain: string,
  options: { readonly totp?: boolean } = {},
): Promise<{ account: PasswordAccount; userId: string }> {
  const account = await insertPasswordAccount(db(), {
    email: freshEmail(domain),
    ...(options.totp === undefined ? {} : { totp: options.totp }),
  });
  const userId = await insertMember(db(), school.id, account.id);
  return { account, userId };
}

const start = (
  browser: Browser,
  provider: string,
  email: string,
  keepSignedIn?: boolean,
): Promise<Response> =>
  browser.post(`/auth/sso/${provider}/start`, {
    email,
    ...(keepSignedIn === undefined ? {} : { keepSignedIn }),
  });

/** Opens the provider page from `start` and returns where the fake issuer sends the browser. */
async function authorize(url: string, signIn?: FakeSignIn): Promise<URL> {
  if (signIn !== undefined) fake().nextSignIn(signIn);
  const response = await fetch(url, { redirect: 'manual' });
  expect(response.status).toBe(302);
  return new URL(response.headers.get('location') ?? '');
}

/** The callback request the browser makes, through the API (`/api/v1` is added by `Browser`). */
const callback = (browser: Browser, location: URL | string): Promise<Response> => {
  const url = typeof location === 'string' ? new URL(location, WEB) : location;
  return browser.get(`${url.pathname.replace(/^\/api\/v1/, '')}${url.search}`);
};

/** Start, the provider page, and the callback: the whole SSO round trip. */
async function signInWithSso(
  browser: Browser,
  email: string,
  options: {
    readonly provider?: SsoProvider;
    readonly signIn?: FakeSignIn;
    readonly keepSignedIn?: boolean;
  } = {},
): Promise<Response> {
  const started = await start(browser, options.provider ?? 'google', email, options.keepSignedIn);
  expect(started.statusCode).toBe(200);
  const location = await authorize(SsoStartResult.parse(started.json()).url, options.signIn);
  return callback(browser, location);
}

/** A refused callback: 303 back to `/sign-in?error=<code>`, no session, the state cookie gone. */
function expectSentBack(response: Response, browser: Browser, error: SsoSignInError): void {
  expect(response.statusCode).toBe(303);
  expect(response.headers.location).toBe(`${WEB}/sign-in?error=${error}`);
  expect(setCookie(response, 'quad_sid')).toBeUndefined();
  expect(setCookie(response, STATE_COOKIE)).toBeDefined();
  expect(browser.cookies.has(STATE_COOKIE)).toBe(false);
  expect(browser.cookies.has('quad_sid')).toBe(false);
}

async function identitiesOf(accountId: string) {
  const { rows } = await db().platform.query<{
    provider: string;
    subject: string;
    email: string | null;
  }>('select provider, subject, email from identities where account_id = $1 order by created_at', [
    accountId,
  ]);
  return rows;
}

/** The audit rows of one action in one school, with their meta. */
async function auditIn(tenantId: string, action: string) {
  const { rows } = await db().platform.query<{ actor_user_id: string | null; meta: unknown }>(
    'select actor_user_id, meta from audit_log where tenant_id = $1 and action = $2 order by at, id',
    [tenantId, action],
  );
  return rows;
}

/**
 * Failure audits are written after the response (`setImmediate`), so "no audit row" needs a
 * positive control: another member's audited refusal in the same school is awaited first, and
 * only then is `userId`'s absence checked.
 */
async function expectNoFailureAudit(school: SchoolSeed, domain: string, userId: string) {
  const control = await insertPasswordAccount(db(), { email: freshEmail('elsewhere.test') });
  const controlUser = await insertMember(db(), school.id, control.id);
  await signInWithSso(new Browser(app), freshEmail(domain), {
    signIn: { email: control.email, hd: 'elsewhere.test' },
  });
  await vi.waitFor(async () => {
    const actors = (await auditIn(school.id, 'auth.sign_in_failed')).map(
      (row) => row.actor_user_id,
    );
    expect(actors).toContain(controlUser);
  });
  const actors = (await auditIn(school.id, 'auth.sign_in_failed')).map((row) => row.actor_user_id);
  expect(actors).not.toContain(userId);
}

const signedInSchool = async (browser: Browser): Promise<string | null> => {
  const me = await browser.get('/me');
  return me.statusCode === 200 ? Me.parse(me.json()).school.id : null;
};

describe('POST /auth/sso/:provider/start (spec 05 step 2)', () => {
  it('returns the provider URL with PKCE (S256), state and nonce, and keeps them in a short-lived HttpOnly cookie', async () => {
    const { domain } = await ssoSchool();
    const email = freshEmail(domain);
    const browser = new Browser(app);

    const response = await start(browser, 'google', email);

    expect(response.statusCode).toBe(200);
    const url = new URL(SsoStartResult.parse(response.json()).url);
    expect(`${url.origin}${url.pathname}`).toBe(`${fake().url}/google/authorize`);
    const params = Object.fromEntries(url.searchParams);
    expect(params).toMatchObject({
      response_type: 'code',
      redirect_uri: `${WEB}/api/v1/auth/sso/google/callback`,
      code_challenge_method: 'S256',
      login_hint: email,
      // Only what sign-in reads (M-6).
      scope: 'openid email',
    });
    for (const name of ['client_id', 'state', 'nonce', 'code_challenge']) {
      expect(params[name], name).toMatch(/^[\w.-]{8,}$/);
    }
    const cookie = setCookie(response, STATE_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 600 });
    // Signed, not a session: nothing about the state is readable as a plain value.
    expect(cookie?.value).not.toContain(params.state);
  });

  it('refuses an unknown provider or a bad email with 400 validation, and sets no cookie', async () => {
    const browser = new Browser(app);
    const unknown = await start(browser, 'github', freshEmail('school.test'));
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json()).toMatchObject({ code: 'validation' });
    const bad = await start(browser, 'google', malformedEmail());
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ code: 'validation' });
    expect(browser.cookies.has(STATE_COOKIE)).toBe(false);
  });

  it('refuses (403) a domain where no school has that provider on', async () => {
    const browser = new Browser(app);
    const response = await start(browser, 'google', freshEmail('nobody-sso.test'));
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'forbidden' });
    expect(browser.cookies.has(STATE_COOKIE)).toBe(false);
  });

  it("never offers school B's provider at school A's domain (cross-tenant)", async () => {
    const a = await ssoSchool({ provider: 'google' });
    await ssoSchool({ provider: 'microsoft' });
    const browser = new Browser(app);
    const response = await start(browser, 'microsoft', freshEmail(a.domain));
    expect(response.statusCode).toBe(403);
    expect(browser.cookies.has(STATE_COOKIE)).toBe(false);
  });
});

describe('GET /auth/sso/:provider/callback (spec 05 step 2): signed in', () => {
  it('links the identity on first use and continues the sign-in (one school, no two-step: done)', async () => {
    const { school, domain } = await ssoSchool();
    const { account, userId } = await staffAt(school, domain);
    const browser = new Browser(app);

    const response = await signInWithSso(browser, account.email);

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(`${WEB}/sign-in?step=done`);
    expect(await signedInSchool(browser)).toBe(school.id);
    expect(await identitiesOf(account.id)).toEqual([
      { provider: 'google', subject: fakeSubjectFor(account.email), email: account.email },
    ]);
    // The state cookie is used up.
    expect(browser.cookies.has(STATE_COOKIE)).toBe(false);
    expect(await auditIn(school.id, 'auth.sign_in')).toEqual([
      { actor_user_id: userId, meta: { switchedSchool: false, method: 'sso:google' } },
    ]);
    expect(await auditIn(school.id, 'auth.sso_linked')).toEqual([
      { actor_user_id: userId, meta: { provider: 'google' } },
    ]);
  });

  it('reuses the linked identity on the second sign-in (Microsoft, vouched by xms_edov)', async () => {
    const { school, domain } = await ssoSchool({ provider: 'microsoft' });
    const { account } = await staffAt(school, domain);

    const first = await signInWithSso(new Browser(app), account.email, { provider: 'microsoft' });
    const second = new Browser(app);
    const again = await signInWithSso(second, account.email, { provider: 'microsoft' });

    expect(first.statusCode).toBe(302);
    expect(again.statusCode).toBe(302);
    expect(await signedInSchool(second)).toBe(school.id);
    expect(await identitiesOf(account.id)).toEqual([
      { provider: 'microsoft', subject: fakeSubjectFor(account.email), email: account.email },
    ]);
    // Linked once, so audited once.
    expect(await auditIn(school.id, 'auth.sso_linked')).toHaveLength(1);
  });

  it('still asks for two-step when the school requires it, and the sign-in audit names SSO after the code', async () => {
    const { school, domain } = await ssoSchool({ twoStep: 'all' });
    const withApp = await staffAt(school, domain, { totp: true });
    const withoutApp = await staffAt(school, domain);

    const browser = new Browser(app);
    const code = await signInWithSso(browser, withApp.account.email);
    const setup = await signInWithSso(new Browser(app), withoutApp.account.email);

    expect(code.headers.location).toBe(`${WEB}/sign-in?step=two_step`);
    expect(setup.headers.location).toBe(`${WEB}/sign-in?step=two_step_setup`);
    expect(await signedInSchool(browser)).toBeNull();

    const verified = await browser.post('/auth/totp/verify', {
      code: await totpCode(withApp.account.totpSecret ?? '', clock),
    });
    expect(verified.json()).toEqual({ next: 'done' });
    expect(await auditIn(school.id, 'auth.sign_in')).toEqual([
      { actor_user_id: withApp.userId, meta: { switchedSchool: false, method: 'sso:google' } },
    ]);
  });

  it('continues to Choose a school with the account’s other schools too (one account opens all)', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const other = await insertSchool(db());
    await insertMember(db(), other.id, account.id);
    const browser = new Browser(app);

    const response = await signInWithSso(browser, account.email);

    expect(response.headers.location).toBe(`${WEB}/sign-in?step=choose_school`);
    const memberships = await browser.get('/auth/memberships');
    const ids = SignInMembershipList.parse(memberships.json()).items.map((item) => item.tenantId);
    expect(ids.sort()).toEqual([school.id, other.id].sort());
    // Opening the other school keeps the session's first factor in its audit.
    expect((await browser.post('/auth/select-school', { tenantId: other.id })).statusCode).toBe(
      204,
    );
    expect(await auditIn(other.id, 'auth.sign_in')).toMatchObject([
      { meta: { switchedSchool: false, method: 'sso:google' } },
    ]);
  });

  it('carries Keep me signed in from start to the session cookie', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const response = await signInWithSso(new Browser(app), account.email, { keepSignedIn: true });
    expect(setCookie(response, 'quad_sid')?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it('forgets earlier failed passwords once SSO has signed the person in', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const guesser = new Browser(app);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await guesser.post('/auth/password', { email: account.email, password: 'wrong password' });
    }
    expect(await redis.zcard(lockoutKey(account.id))).toBe(2);

    const response = await signInWithSso(new Browser(app), account.email);

    expect(response.headers.location).toBe(`${WEB}/sign-in?step=done`);
    expect(await redis.zcard(lockoutKey(account.id))).toBe(0);
  });

  it('lets SSO-only staff of a suspended school reach the suspension notice (Choose a school)', async () => {
    const { school, domain } = await ssoSchool({
      status: 'suspended',
      suspendReason: 'The subscription is unpaid.',
    });
    const { account } = await staffAt(school, domain);
    const browser = new Browser(app);
    const response = await signInWithSso(browser, account.email);
    expect(response.headers.location).toBe(`${WEB}/sign-in?step=choose_school`);
    const memberships = await browser.get('/auth/memberships');
    expect(memberships.json()).toMatchObject({
      items: [
        { tenantId: school.id, suspended: true, suspendReason: 'The subscription is unpaid.' },
      ],
    });
  });
});

describe('GET /auth/sso/:provider/callback: sent back with sso_unfinished', () => {
  async function started(): Promise<{ browser: Browser; email: string; url: string }> {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const browser = new Browser(app);
    const response = await start(browser, 'google', account.email);
    return { browser, email: account.email, url: SsoStartResult.parse(response.json()).url };
  }

  it('an unknown provider, or a callback with neither a code nor an error (validation)', async () => {
    const browser = new Browser(app);
    expectSentBack(
      await callback(browser, '/api/v1/auth/sso/github/callback?code=c&state=s'),
      browser,
      'sso_unfinished',
    );
    expectSentBack(
      await callback(browser, '/api/v1/auth/sso/google/callback?state=s'),
      browser,
      'sso_unfinished',
    );
  });

  it('a forged state', async () => {
    const { browser, url } = await started();
    const location = await authorize(url);
    location.searchParams.set('state', 'forged-state-value-0000');
    expectSentBack(await callback(browser, location), browser, 'sso_unfinished');
  });

  it('a wrong nonce in the ID token', async () => {
    const { browser, url } = await started();
    const location = await authorize(url, { nonce: 'someone-elses-nonce' });
    expectSentBack(await callback(browser, location), browser, 'sso_unfinished');
  });

  it('an ID token signed with a key the issuer does not publish', async () => {
    const { browser, url } = await started();
    const location = await authorize(url, { signWithForeignKey: true });
    expectSentBack(await callback(browser, location), browser, 'sso_unfinished');
  });

  it('no state cookie (another browser, or a link sent to a victim)', async () => {
    const { url } = await started();
    const location = await authorize(url);
    const victim = new Browser(app);
    expectSentBack(await callback(victim, location), victim, 'sso_unfinished');
  });

  it('a tampered state cookie', async () => {
    const { browser, url } = await started();
    const location = await authorize(url);
    const value = browser.cookies.get(STATE_COOKIE) ?? '';
    browser.cookies.set(STATE_COOKIE, `${value.slice(0, -2)}AA`);
    expectSentBack(await callback(browser, location), browser, 'sso_unfinished');
  });

  it('an expired state cookie (more than 10 minutes at the provider)', async () => {
    const { browser, url } = await started();
    const location = await authorize(url);
    clock = NOW + 11 * MINUTE_MS;
    expectSentBack(await callback(browser, location), browser, 'sso_unfinished');
  });

  it("another provider's callback", async () => {
    const { browser, url } = await started();
    const location = await authorize(url);
    location.pathname = location.pathname.replace('/google/', '/microsoft/');
    expectSentBack(await callback(browser, location), browser, 'sso_unfinished');
  });

  it('a replayed code', async () => {
    const { browser, url } = await started();
    const location = await authorize(url);
    const replay = browser.clone();
    expect((await callback(browser, location)).statusCode).toBe(302);
    expectSentBack(await callback(replay, location), replay, 'sso_unfinished');
  });

  it('an unexpected error (logged and reported, never a JSON 500 page)', async () => {
    const { browser, url } = await started();
    const location = await authorize(url);
    const definers = app().get<QuadTenantDb>(TENANT_DB).definers;
    const failure = new Error('The signed_token_uses insert failed.');
    const consume = vi.spyOn(definers, 'consumeSignedToken').mockRejectedValueOnce(failure);
    logs.lines.length = 0;
    try {
      expectSentBack(await callback(browser, location), browser, 'sso_unfinished');
    } finally {
      consume.mockRestore();
    }
    expect(reported).toContain(failure);
    const failed = logs.lines.filter((line) => line.metric === 'sso_callback_failed');
    expect(failed).toMatchObject([{ level: 'error', error: { message: failure.message } }]);
    // Never the query string: no code or state in any line.
    const code = location.searchParams.get('code') ?? '';
    expect(JSON.stringify(logs.lines)).not.toContain(code);
  });

  it('a replayed state cookie with a fresh code (the state is single use)', async () => {
    const { browser, url } = await started();
    const replay = browser.clone();
    expect((await callback(browser, await authorize(url))).statusCode).toBe(302);
    // The same authorize URL gives a new, unused code for the same state, nonce and challenge.
    expectSentBack(await callback(replay, await authorize(url)), replay, 'sso_unfinished');
  });
});

describe('GET /auth/sso/:provider/callback: sent back with sso_cancelled', () => {
  it('when the person cancels at the provider (error=access_denied)', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const browser = new Browser(app);
    await start(browser, 'google', account.email);
    const response = await callback(
      browser,
      '/api/v1/auth/sso/google/callback?error=access_denied&error_description=No&state=s',
    );
    expectSentBack(response, browser, 'sso_cancelled');
  });
});

describe('GET /auth/sso/:provider/callback: sent back with sso_refused, nothing linked', () => {
  const expectRefused = async (
    response: Response,
    browser: Browser,
    accountId: string,
  ): Promise<void> => {
    expectSentBack(response, browser, 'sso_refused');
    expect(await identitiesOf(accountId)).toEqual([]);
  };

  it('an ID token with no email', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const browser = new Browser(app);
    const response = await signInWithSso(browser, account.email, { signIn: { email: null } });
    await expectRefused(response, browser, account.id);
  });

  it('a Google email that is not verified', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const browser = new Browser(app);
    const response = await signInWithSso(browser, account.email, {
      signIn: { emailVerified: false },
    });
    await expectRefused(response, browser, account.id);
  });

  it('a Google account without the Workspace hd (a consumer account holding the work address)', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const browser = new Browser(app);
    const response = await signInWithSso(browser, account.email, { signIn: { hd: null } });
    await expectRefused(response, browser, account.id);
  });

  it("a Google account of another Workspace (hd is not the school's sso_domain)", async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const browser = new Browser(app);
    const response = await signInWithSso(browser, account.email, {
      signIn: { hd: 'elsewhere.test' },
    });
    await expectRefused(response, browser, account.id);
  });

  it('a Microsoft token without xms_edov', async () => {
    const { school, domain } = await ssoSchool({ provider: 'microsoft' });
    const { account } = await staffAt(school, domain);
    const browser = new Browser(app);
    const response = await signInWithSso(browser, account.email, {
      provider: 'microsoft',
      signIn: { xmsEdov: null },
    });
    await expectRefused(response, browser, account.id);
  });

  it('a Microsoft token with email_verified but no xms_edov (nOAuth: email_verified is ignored)', async () => {
    const { school, domain } = await ssoSchool({ provider: 'microsoft' });
    const { account } = await staffAt(school, domain);
    const browser = new Browser(app);
    const response = await signInWithSso(browser, account.email, {
      provider: 'microsoft',
      signIn: { xmsEdov: null, emailVerified: true },
    });
    await expectRefused(response, browser, account.id);
  });

  it.each<[string, FakeSignIn]>([
    ['an unverified email', { emailVerified: false }],
    ['no Workspace hd', { hd: null }],
  ])(
    'a Google token with %s for a locked account: the plain refusal, no lookup and no audit',
    async (_name, signIn) => {
      const { school, domain } = await ssoSchool();
      const { account, userId } = await staffAt(school, domain);
      await db().platform.query(`update accounts set status = 'locked' where id = $1`, [
        account.id,
      ]);
      const browser = new Browser(app);

      const response = await signInWithSso(browser, account.email, { signIn });

      await expectRefused(response, browser, account.id);
      await expectNoFailureAudit(school, domain, userId);
    },
  );

  it("a member whose email is outside the school's sso_domain (audited)", async () => {
    const { school, domain } = await ssoSchool();
    const account = await insertPasswordAccount(db(), { email: freshEmail('elsewhere.test') });
    const userId = await insertMember(db(), school.id, account.id);
    const browser = new Browser(app);
    // The person picks their other account at the provider.
    const response = await signInWithSso(browser, freshEmail(domain), {
      signIn: { email: account.email, hd: 'elsewhere.test' },
    });
    await expectRefused(response, browser, account.id);
    await vi.waitFor(async () => {
      expect(await auditIn(school.id, 'auth.sign_in_failed')).toEqual([
        { actor_user_id: userId, meta: { reason: 'sso_refused' } },
      ]);
    });
  });

  it('an email with no Quad account', async () => {
    const { domain } = await ssoSchool();
    const browser = new Browser(app);
    expectSentBack(await signInWithSso(browser, freshEmail(domain)), browser, 'sso_refused');
  });

  it('a disabled account', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    await db().platform.query(`update accounts set status = 'disabled' where id = $1`, [
      account.id,
    ]);
    const browser = new Browser(app);
    await expectRefused(await signInWithSso(browser, account.email), browser, account.id);
  });

  it('a deactivated membership in the SSO school', async () => {
    const { school, domain } = await ssoSchool();
    const account = await insertPasswordAccount(db(), { email: freshEmail(domain) });
    await insertMember(db(), school.id, account.id, { status: 'deactivated' });
    const browser = new Browser(app);
    await expectRefused(await signInWithSso(browser, account.email), browser, account.id);
  });

  it('a subject that is already linked to another account', async () => {
    const { school, domain } = await ssoSchool();
    const owner = await staffAt(school, domain);
    const other = await staffAt(school, domain);
    const subject = fakeSubjectFor(owner.account.email);
    await signInWithSso(new Browser(app), owner.account.email);

    const browser = new Browser(app);
    const response = await signInWithSso(browser, other.account.email, {
      signIn: { sub: subject },
    });

    await expectRefused(response, browser, other.account.id);
    expect(await identitiesOf(owner.account.id)).toHaveLength(1);
  });

  it('an account already linked to another subject of that provider', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    await signInWithSso(new Browser(app), account.email);

    const browser = new Browser(app);
    const response = await signInWithSso(browser, account.email, {
      signIn: { sub: 'a-different-subject' },
    });

    expectSentBack(response, browser, 'sso_refused');
    expect(await identitiesOf(account.id)).toEqual([
      { provider: 'google', subject: fakeSubjectFor(account.email), email: account.email },
    ]);
  });

  it("school A's SSO domain never opens school B without a B membership (cross-tenant)", async () => {
    const a = await ssoSchool();
    const b = await insertSchool(db());
    const account = await insertPasswordAccount(db(), { email: freshEmail(a.domain) });
    await insertMember(db(), b.id, account.id);
    const browser = new Browser(app);

    const response = await signInWithSso(browser, account.email);

    await expectRefused(response, browser, account.id);
    expect((await auditRows(db(), 'auth.sign_in')).filter((row) => row.tenant_id === b.id)).toEqual(
      [],
    );
  });

  it('a school whose SSO uses the other provider (cross-tenant)', async () => {
    const a = await ssoSchool({ provider: 'microsoft' });
    const { account } = await staffAt(a.school, a.domain);
    // Another school at the same domain offers Google, but the account is not a member there.
    const b = await insertSchool(db());
    await setSignInRules(db(), b.id, { ssoDomain: a.domain, ssoGoogle: true });
    const browser = new Browser(app);

    const response = await signInWithSso(browser, account.email, { provider: 'google' });

    await expectRefused(response, browser, account.id);
  });
});

describe('GET /auth/sso/:provider/callback: sent back with account_locked', () => {
  it('a vouched sign-in of a locked account', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    await db().platform.query(`update accounts set locked_until = $2 where id = $1`, [
      account.id,
      new Date(NOW + 10 * MINUTE_MS),
    ]);
    const browser = new Browser(app);
    expectSentBack(await signInWithSso(browser, account.email), browser, 'account_locked');
    expect(await identitiesOf(account.id)).toEqual([]);
  });
});

describe('AuthRepository.linkIdentity', () => {
  it('links one subject of a provider when two first sign-ins race (unique account and provider)', async () => {
    const account = await insertPasswordAccount(db());
    const repository = app().get(AuthRepository);
    const results = await Promise.all(
      ['subject-one', 'subject-two'].map((subject) =>
        repository.linkIdentity(account.id, 'google', subject, account.email),
      ),
    );
    expect(results.sort()).toEqual(['conflict', 'linked']);
    expect(await identitiesOf(account.id)).toHaveLength(1);
  });
});
