import { describe, expect, it } from 'vitest';

import { Browser, setCookie } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember, insertSchool, setSchoolStatus } from '../helpers/identity';
import { auditRows, insertPasswordAccount } from '../helpers/sign-in';

const NOW = Date.UTC(2026, 9, 8, 3, 30, 1);
const { db, app } = useDatabaseApp({}, { overrides: { now: () => NOW } });

async function signedIn(schools = 1): Promise<{ browser: Browser; tenantIds: string[] }> {
  const account = await insertPasswordAccount(db());
  const tenantIds: string[] = [];
  for (let count = 0; count < schools; count += 1) {
    const school = await insertSchool(db());
    await insertMember(db(), school.id, account.id);
    tenantIds.push(school.id);
  }
  const browser = new Browser(app);
  await browser.post('/auth/password', { email: account.email, password: account.password });
  return { browser, tenantIds };
}

describe('POST /auth/sign-out (spec 05: ends the session for every school)', () => {
  it('answers 204, clears both cookies, and the old cookie then gets 401', async () => {
    const { browser, tenantIds } = await signedIn();
    const old = browser.clone();
    const before = await auditRows(db(), 'auth.sign_out');

    const response = await browser.post('/auth/sign-out');

    expect(response.statusCode).toBe(204);
    expect(setCookie(response, 'quad_sid')?.value).toBe('');
    expect(setCookie(response, 'quad_csrf')?.value).toBe('');
    expect(browser.cookies.has('quad_sid')).toBe(false);
    expect((await old.get('/me')).statusCode).toBe(401);
    const audits = (await auditRows(db(), 'auth.sign_out')).slice(before.length);
    expect(audits.map((row) => row.tenant_id)).toEqual(tenantIds);
  });

  it('signs out a sign-in that has not chosen a school yet', async () => {
    const { browser } = await signedIn(2);
    const old = browser.clone();
    expect((await browser.post('/auth/sign-out')).statusCode).toBe(204);
    expect((await old.get('/auth/memberships')).statusCode).toBe(401);
  });

  it('is allowed in a suspended school', async () => {
    const { browser, tenantIds } = await signedIn();
    await setSchoolStatus(db(), tenantIds[0] ?? '', 'suspended');
    expect((await browser.post('/auth/sign-out')).statusCode).toBe(204);
  });

  it('answers 401 without a session', async () => {
    expect((await new Browser(app).post('/auth/sign-out')).statusCode).toBe(401);
  });

  it('answers 403 without the CSRF header', async () => {
    const { browser } = await signedIn();
    expect((await browser.post('/auth/sign-out', undefined, { csrf: false })).statusCode).toBe(403);
    expect((await browser.get('/me')).statusCode).toBe(200);
  });

  it("signs out only this session, never another person's", async () => {
    const mine = await signedIn();
    const theirs = await signedIn();
    await mine.browser.post('/auth/sign-out');
    expect((await theirs.browser.get('/me')).statusCode).toBe(200);
  });
});
