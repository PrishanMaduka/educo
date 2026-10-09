import { ErrorBodySchema, IdentifyResult } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember, insertSchool } from '../helpers/identity';
import {
  anyText,
  freshEmail,
  insertPasswordAccount,
  malformedEmail,
  setSignInRules,
} from '../helpers/sign-in';

/** A fixed instant early in a minute, so a test's calls share one rate-limit window. */
const NOW = Date.UTC(2026, 9, 8, 3, 30, 1);

const { db, app } = useDatabaseApp({}, { overrides: { now: () => NOW } });

const identify = (browser: Browser, email: unknown) => browser.post('/auth/identify', { email });

describe('POST /auth/identify (spec 05 step 1)', () => {
  it('offers password to anyone', async () => {
    const account = await insertPasswordAccount(db());
    const response = await identify(new Browser(app), account.email);
    expect(response.statusCode).toBe(200);
    expect(IdentifyResult.parse(response.json())).toEqual({ methods: ['password'] });
  });

  it("offers a school's SSO buttons first when the email's domain is that school's", async () => {
    const school = await insertSchool(db());
    const domain = `sso-${school.id.slice(0, 8)}.test`;
    await setSignInRules(db(), school.id, {
      ssoDomain: domain,
      ssoGoogle: true,
      ssoMicrosoft: true,
    });
    const response = await identify(new Browser(app), `Someone@${domain.toUpperCase()}`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ methods: ['sso:google', 'sso:microsoft', 'password'] });
  });

  it('gives the same body and status for an unknown email and a known one at the same domain (Accept)', async () => {
    const school = await insertSchool(db());
    const domain = `same-${school.id.slice(0, 8)}.test`;
    await setSignInRules(db(), school.id, { ssoDomain: domain, ssoGoogle: true });
    const known = await insertPasswordAccount(db(), { email: freshEmail(domain) });
    await insertMember(db(), school.id, known.id);

    const forKnown = await identify(new Browser(app), known.email);
    const forUnknown = await identify(new Browser(app), freshEmail(domain));

    expect(forKnown.statusCode).toBe(200);
    expect(forUnknown.statusCode).toBe(forKnown.statusCode);
    expect(forUnknown.body).toBe(forKnown.body);
    expect(forUnknown.headers['content-type']).toBe(forKnown.headers['content-type']);
    expect(forUnknown.headers['set-cookie']).toBeUndefined();
    expect(forKnown.headers['set-cookie']).toBeUndefined();
  });

  it.each([{}, { email: malformedEmail() }, { email: 42 }])(
    'answers 400 validation for %j',
    async (body) => {
      const response = await new Browser(app).post('/auth/identify', body);
      expect(response.statusCode).toBe(400);
      expect(ErrorBodySchema.parse(response.json())).toMatchObject({
        code: 'validation',
        fields: { email: anyText() },
      });
    },
  );

  it("never offers school A's SSO for an email at school B's domain", async () => {
    const schoolA = await insertSchool(db());
    const schoolB = await insertSchool(db());
    await setSignInRules(db(), schoolA.id, {
      ssoDomain: `a-${schoolA.id.slice(0, 8)}.test`,
      ssoGoogle: true,
    });
    await setSignInRules(db(), schoolB.id, {
      ssoDomain: `b-${schoolB.id.slice(0, 8)}.test`,
      ssoMicrosoft: true,
    });
    const response = await identify(new Browser(app), `x@b-${schoolB.id.slice(0, 8)}.test`);
    expect(response.json()).toEqual({ methods: ['sso:microsoft', 'password'] });
  });

  it('answers 429 after 20 calls a minute from one IP (spec 06)', async () => {
    const browser = new Browser(app);
    for (let call = 1; call <= 20; call += 1) {
      expect((await identify(browser, freshEmail())).statusCode).toBe(200);
    }
    const refused = await identify(browser, freshEmail());
    expect(refused.statusCode).toBe(429);
    expect(refused.json()).toMatchObject({ code: 'rate_limited' });
    expect(refused.headers['retry-after']).toBeDefined();
  });

  it('answers 429 after 10 calls in 15 minutes for one email, from any IP', async () => {
    const email = freshEmail();
    for (let call = 1; call <= 10; call += 1) {
      expect((await identify(new Browser(app), email)).statusCode).toBe(200);
    }
    // Spelled differently, it is still the same address.
    const refused = await identify(new Browser(app), `  ${email.toUpperCase()} `);
    expect(refused.statusCode).toBe(429);
    expect(refused.json()).toMatchObject({ code: 'rate_limited' });
    // Another address from a fresh IP is not affected.
    expect((await identify(new Browser(app), freshEmail())).statusCode).toBe(200);
  });
});
