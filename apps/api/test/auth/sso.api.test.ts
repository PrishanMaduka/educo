import { randomBytes } from 'node:crypto';

import { Me, SsoStartResult } from '@quad/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
} from '../helpers/sign-in';

import type { FakeOidcIssuer, FakeSignIn } from '../fakes/oidc-issuer';
import type { SchoolSeed } from '../helpers/identity';
import type { PasswordAccount } from '../helpers/sign-in';
import type { SsoProvider, TenantStatus, TwoStepRule } from '@quad/contracts';
import type { LightMyRequestResponse as Response } from 'fastify';

/**
 * Staff SSO (spec 05 step 2; Task 8): OIDC with PKCE, state and nonce, against the fake issuer
 * only (D32). The school comes from the account's own memberships, never from the provider.
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

beforeAll(async () => {
  issuer = await startFakeOidcIssuer();
});
afterAll(async () => {
  await issuer?.close();
});

const { db, app } = useDatabaseApp(() => ({ OIDC_FAKE_ISSUER_URL: fake().url }), {
  overrides: { now: () => clock },
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
const callback = (browser: Browser, location: URL): Promise<Response> =>
  browser.get(`${location.pathname.replace(/^\/api\/v1/, '')}${location.search}`);

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
    expect(`${url.origin}${url.pathname}`).toBe(`${fake().url}/authorize`);
    const params = Object.fromEntries(url.searchParams);
    expect(params).toMatchObject({
      response_type: 'code',
      redirect_uri: `${WEB}/api/v1/auth/sso/google/callback`,
      code_challenge_method: 'S256',
      login_hint: email,
    });
    expect(params.scope?.split(' ')).toEqual(expect.arrayContaining(['openid', 'email']));
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

describe('GET /auth/sso/:provider/callback (spec 05 step 2)', () => {
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
    const audits = (await auditRows(db(), 'auth.sign_in')).filter(
      (row) => row.tenant_id === school.id,
    );
    expect(audits).toEqual([{ tenant_id: school.id, actor_user_id: userId, target_id: userId }]);
  });

  it('reuses the linked identity on the second sign-in', async () => {
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
  });

  it('still asks for two-step when the school requires it (the same next step as the password)', async () => {
    const { school, domain } = await ssoSchool({ twoStep: 'all' });
    const withApp = await staffAt(school, domain, { totp: true });
    const withoutApp = await staffAt(school, domain);

    const browser = new Browser(app);
    const code = await signInWithSso(browser, withApp.account.email);
    const setup = await signInWithSso(new Browser(app), withoutApp.account.email);

    expect(code.headers.location).toBe(`${WEB}/sign-in?step=two_step`);
    expect(setup.headers.location).toBe(`${WEB}/sign-in?step=two_step_setup`);
    expect(await signedInSchool(browser)).toBeNull();
  });

  it('carries Keep me signed in from start to the session cookie', async () => {
    const { school, domain } = await ssoSchool();
    const { account } = await staffAt(school, domain);
    const response = await signInWithSso(new Browser(app), account.email, { keepSignedIn: true });
    expect(setCookie(response, 'quad_sid')?.maxAge).toBe(30 * 24 * 60 * 60);
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

  it('refuses an unknown provider or a callback without a code with 400 validation', async () => {
    const browser = new Browser(app);
    const unknown = await browser.get('/auth/sso/github/callback?code=c&state=s');
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json()).toMatchObject({ code: 'validation' });
    const noCode = await browser.get('/auth/sso/google/callback?state=s');
    expect(noCode.statusCode).toBe(400);
    expect(noCode.json()).toMatchObject({ code: 'validation' });
  });

  describe('refuses with 401 and opens no session', () => {
    async function started(): Promise<{ browser: Browser; email: string; url: string }> {
      const { school, domain } = await ssoSchool();
      const { account } = await staffAt(school, domain);
      const browser = new Browser(app);
      const response = await start(browser, 'google', account.email);
      return { browser, email: account.email, url: SsoStartResult.parse(response.json()).url };
    }

    const expectRefused = (response: Response, browser: Browser): void => {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'unauthorized' });
      expect(browser.cookies.has('quad_sid')).toBe(false);
    };

    it('a forged state', async () => {
      const { browser, url } = await started();
      const location = await authorize(url);
      location.searchParams.set('state', 'forged-state-value-0000');
      expectRefused(await callback(browser, location), browser);
    });

    it('a wrong nonce in the ID token', async () => {
      const { browser, url } = await started();
      const location = await authorize(url, { nonce: 'someone-elses-nonce' });
      expectRefused(await callback(browser, location), browser);
    });

    it('no state cookie (another browser, or a link sent to a victim)', async () => {
      const { url } = await started();
      const location = await authorize(url);
      const victim = new Browser(app);
      expectRefused(await callback(victim, location), victim);
    });

    it('a tampered state cookie', async () => {
      const { browser, url } = await started();
      const location = await authorize(url);
      const value = browser.cookies.get(STATE_COOKIE) ?? '';
      browser.cookies.set(STATE_COOKIE, `${value.slice(0, -2)}AA`);
      expectRefused(await callback(browser, location), browser);
    });

    it('an expired state cookie (more than 10 minutes at the provider)', async () => {
      const { browser, url } = await started();
      const location = await authorize(url);
      clock = NOW + 11 * MINUTE_MS;
      expectRefused(await callback(browser, location), browser);
    });

    it("another provider's callback", async () => {
      const { browser, url } = await started();
      const location = await authorize(url);
      location.pathname = location.pathname.replace('/google/', '/microsoft/');
      expectRefused(await callback(browser, location), browser);
    });

    it('a replayed code', async () => {
      const { browser, url } = await started();
      const location = await authorize(url);
      const replay = browser.clone();
      expect((await callback(browser, location)).statusCode).toBe(302);
      const response = await callback(replay, location);
      expect(response.statusCode).toBe(401);
    });
  });

  describe('refuses with 403 and links nothing', () => {
    const expectForbidden = async (
      response: Response,
      browser: Browser,
      accountId: string,
    ): Promise<void> => {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'forbidden' });
      expect(browser.cookies.has('quad_sid')).toBe(false);
      expect(await identitiesOf(accountId)).toEqual([]);
    };

    it("a member whose email is outside the school's sso_domain", async () => {
      const { school, domain } = await ssoSchool();
      const account = await insertPasswordAccount(db(), { email: freshEmail('elsewhere.test') });
      await insertMember(db(), school.id, account.id);
      const browser = new Browser(app);
      // The person picks their other account at the provider.
      const response = await signInWithSso(browser, freshEmail(domain), {
        signIn: { email: account.email },
      });
      await expectForbidden(response, browser, account.id);
    });

    it('an email the provider has not verified', async () => {
      const { school, domain } = await ssoSchool();
      const { account } = await staffAt(school, domain);
      const browser = new Browser(app);
      const response = await signInWithSso(browser, account.email, {
        signIn: { emailVerified: false },
      });
      await expectForbidden(response, browser, account.id);
    });

    it('an email with no Quad account', async () => {
      const { domain } = await ssoSchool();
      const browser = new Browser(app);
      const response = await signInWithSso(browser, freshEmail(domain));
      expect(response.statusCode).toBe(403);
      expect(browser.cookies.has('quad_sid')).toBe(false);
    });

    it('a disabled account', async () => {
      const { school, domain } = await ssoSchool();
      const { account } = await staffAt(school, domain);
      await db().platform.query(`update accounts set status = 'disabled' where id = $1`, [
        account.id,
      ]);
      const browser = new Browser(app);
      await expectForbidden(await signInWithSso(browser, account.email), browser, account.id);
    });

    it('a locked account, with 403 account_locked', async () => {
      const { school, domain } = await ssoSchool();
      const { account } = await staffAt(school, domain);
      await db().platform.query(`update accounts set locked_until = $2 where id = $1`, [
        account.id,
        new Date(NOW + 10 * MINUTE_MS),
      ]);
      const browser = new Browser(app);
      const response = await signInWithSso(browser, account.email);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'account_locked' });
      expect(browser.cookies.has('quad_sid')).toBe(false);
      expect(await identitiesOf(account.id)).toEqual([]);
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

      await expectForbidden(response, browser, other.account.id);
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

      expect(response.statusCode).toBe(403);
      expect(browser.cookies.has('quad_sid')).toBe(false);
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

      await expectForbidden(response, browser, account.id);
      const audits = (await auditRows(db(), 'auth.sign_in')).filter(
        (row) => row.tenant_id === b.id,
      );
      expect(audits).toEqual([]);
    });

    it('a school whose SSO uses the other provider (cross-tenant)', async () => {
      const a = await ssoSchool({ provider: 'microsoft' });
      const { account } = await staffAt(a.school, a.domain);
      // Another school at the same domain offers Google, but the account is not a member there.
      const b = await insertSchool(db());
      await setSignInRules(db(), b.id, { ssoDomain: a.domain, ssoGoogle: true });
      const browser = new Browser(app);

      const response = await signInWithSso(browser, account.email, { provider: 'google' });

      await expectForbidden(response, browser, account.id);
    });
  });
});
