import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { RecordingDelivery } from '../fakes/delivery';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertMember, insertSchool } from '../helpers/identity';
import { emailsTo, insertPasswordAccount } from '../helpers/sign-in';

import type { PasswordAccount } from '../helpers/sign-in';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const MINUTE = 60_000;
const T0 = Date.UTC(2026, 9, 8, 3, 30, 1);
let clock = T0;
const delivery = new RecordingDelivery();
const redis = new Redis(REDIS_URL);

const { db, app } = useDatabaseApp({}, { overrides: { now: () => clock, delivery } });

beforeEach(() => {
  clock = T0;
});

afterAll(async () => {
  await redis.quit();
});

async function staffAccount(): Promise<PasswordAccount> {
  const school = await insertSchool(db());
  const account = await insertPasswordAccount(db());
  await insertMember(db(), school.id, account.id);
  return account;
}

const signIn = (account: PasswordAccount, password: string) =>
  new Browser(app).post('/auth/password', { email: account.email, password });

const lockedUntil = async (accountId: string): Promise<Date | null> => {
  const { rows } = await db().platform.query<{ locked_until: Date | null }>(
    'select locked_until from accounts where id = $1',
    [accountId],
  );
  return rows[0]?.locked_until ?? null;
};

describe('lockout (spec 05 step 7: five failures in 15 minutes lock it for 15 minutes)', () => {
  it('refuses the 6th try with 403 account_locked, even with the right password, and emails the person once', async () => {
    const account = await staffAccount();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      clock = T0 + attempt * 1000;
      const response = await signIn(account, 'wrong password here');
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'invalid_credentials' });
    }
    clock = T0 + 6000;
    const sixth = await signIn(account, account.password);

    expect(sixth.statusCode).toBe(403);
    expect(sixth.json()).toMatchObject({ code: 'account_locked' });
    expect(await lockedUntil(account.id)).toEqual(new Date(T0 + 5000 + 15 * MINUTE));
    const emails = emailsTo(delivery, account.email, 'lockout');
    expect(emails).toHaveLength(1);
    expect(emails[0]?.job).toMatchObject({
      tenantId: null,
      school: null,
      params: { attempts: 5, minutes: 15 },
    });
  });

  it('keeps the failures in the Redis sorted set lockout:{accountId} with a 15-minute TTL', async () => {
    const account = await staffAccount();
    await signIn(account, 'wrong password here');
    const key = `lockout:${account.id}`;
    expect(await redis.zcard(key)).toBe(1);
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(15 * 60);
  });

  it('lets the person in again once the 15 minutes are over', async () => {
    const account = await staffAccount();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await signIn(account, 'wrong password here');
    }
    clock = T0 + 15 * MINUTE - 1000;
    expect((await signIn(account, account.password)).statusCode).toBe(403);
    clock = T0 + 15 * MINUTE;
    const response = await signIn(account, account.password);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ next: 'done' });
  });

  it('counts only failures within 15 minutes', async () => {
    const account = await staffAccount();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await signIn(account, 'wrong password here');
    }
    clock = T0 + 15 * MINUTE;
    expect((await signIn(account, 'wrong password here')).statusCode).toBe(401);
    expect((await signIn(account, account.password)).statusCode).toBe(200);
    expect(await lockedUntil(account.id)).toBeNull();
  });

  it('starts counting afresh after a successful sign-in', async () => {
    const account = await staffAccount();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await signIn(account, 'wrong password here');
    }
    expect((await signIn(account, account.password)).statusCode).toBe(200);
    expect((await signIn(account, 'wrong password here')).statusCode).toBe(401);
    expect((await signIn(account, account.password)).statusCode).toBe(200);
  });

  it("never locks another account: one person's failures stay theirs", async () => {
    const account = await staffAccount();
    const other = await staffAccount();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await signIn(account, 'wrong password here');
    }
    expect((await signIn(other, other.password)).statusCode).toBe(200);
  });
});
