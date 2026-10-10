import { SignInMembershipList } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { brandPalette } from '../../src/common/branding/brand-palette';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember, insertRole, insertSchool, setSchoolStatus } from '../helpers/identity';
import { insertPasswordAccount } from '../helpers/sign-in';

import type { PasswordAccount } from '../helpers/sign-in';

const NOW = Date.UTC(2026, 9, 8, 3, 30, 1);
const { db, app } = useDatabaseApp({}, { overrides: { now: () => NOW } });

async function signIn(account: PasswordAccount): Promise<Browser> {
  const browser = new Browser(app);
  await browser.post('/auth/password', { email: account.email, password: account.password });
  return browser;
}

describe('GET /auth/memberships (spec 05 step 5: Choose a school)', () => {
  it("lists the account's staff schools with name, brand and roles", async () => {
    const colombo = await insertSchool(db(), {
      name: 'Colombo International School',
      shortName: 'CIS',
      brandColor: '#1F6F5C',
    });
    const kandy = await insertSchool(db(), { name: 'Kandy Hills College', shortName: 'KHC' });
    const account = await insertPasswordAccount(db());
    const inColombo = await insertMember(db(), colombo.id, account.id);
    await insertRole(db(), colombo.id, inColombo, 'School admin');
    await insertMember(db(), kandy.id, account.id);
    const browser = await signIn(account);

    const response = await browser.get('/auth/memberships');

    expect(response.statusCode).toBe(200);
    const list = SignInMembershipList.parse(response.json());
    expect(list.items).toEqual([
      {
        tenantId: colombo.id,
        name: 'Colombo International School',
        shortName: 'CIS',
        logoUrl: null,
        brand: brandPalette('#1F6F5C'),
        roleNames: ['School admin'],
        suspended: false,
        suspendReason: null,
      },
      expect.objectContaining({ tenantId: kandy.id, name: 'Kandy Hills College', roleNames: [] }),
    ]);
  });

  it('lists a suspended school with its reason, so the page can explain it', async () => {
    const open = await insertSchool(db());
    const paused = await insertSchool(db(), { suspendReason: 'The subscription is unpaid.' });
    await setSchoolStatus(db(), paused.id, 'suspended');
    const account = await insertPasswordAccount(db());
    await insertMember(db(), open.id, account.id);
    await insertMember(db(), paused.id, account.id);
    const list = SignInMembershipList.parse(
      (await (await signIn(account)).get('/auth/memberships')).json(),
    );
    expect(list.items.find((item) => item.tenantId === paused.id)).toMatchObject({
      suspended: true,
      suspendReason: 'The subscription is unpaid.',
    });
  });

  it('never lists a deactivated membership, a deleted school or a guardian membership', async () => {
    const open = await insertSchool(db());
    const other = await insertSchool(db());
    const left = await insertSchool(db());
    const deleted = await insertSchool(db());
    const family = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), open.id, account.id);
    await insertMember(db(), other.id, account.id);
    await insertMember(db(), left.id, account.id, { status: 'deactivated' });
    await insertMember(db(), deleted.id, account.id);
    await setSchoolStatus(db(), deleted.id, 'deleted');
    await insertMember(db(), family.id, account.id, { kind: 'guardian' });
    const list = SignInMembershipList.parse(
      (await (await signIn(account)).get('/auth/memberships')).json(),
    );
    expect(list.items.map((item) => item.tenantId).sort()).toEqual([open.id, other.id].sort());
  });

  it("never lists another account's schools", async () => {
    const mine = await insertSchool(db());
    const mineToo = await insertSchool(db());
    const theirs = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), mine.id, account.id);
    await insertMember(db(), mineToo.id, account.id);
    const someoneElse = await insertPasswordAccount(db());
    await insertMember(db(), theirs.id, someoneElse.id);
    const list = SignInMembershipList.parse(
      (await (await signIn(account)).get('/auth/memberships')).json(),
    );
    expect(list.items.map((item) => item.tenantId)).not.toContain(theirs.id);
  });

  it('works from an active session too (Switch school)', async () => {
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), school.id, account.id);
    const browser = await signIn(account);
    expect((await browser.get('/me')).statusCode).toBe(200);
    expect((await browser.get('/auth/memberships')).statusCode).toBe(200);
  });

  it('answers 401 without a session, and at stage two_step (before the code)', async () => {
    expect((await new Browser(app).get('/auth/memberships')).statusCode).toBe(401);
    const school = await insertSchool(db());
    const account = await insertPasswordAccount(db(), { totp: true });
    await insertMember(db(), school.id, account.id);
    const browser = await signIn(account);
    const response = await browser.get('/auth/memberships');
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'unauthorized' });
  });

  it('ignores query input: ?school= never filters or adds a school', async () => {
    const a = await insertSchool(db());
    const b = await insertSchool(db());
    const stranger = await insertSchool(db());
    const account = await insertPasswordAccount(db());
    await insertMember(db(), a.id, account.id);
    await insertMember(db(), b.id, account.id);
    const browser = await signIn(account);
    const list = SignInMembershipList.parse(
      (await browser.get(`/auth/memberships?school=${stranger.id}`)).json(),
    );
    expect(list.items.map((item) => item.tenantId).sort()).toEqual([a.id, b.id].sort());
  });
});
