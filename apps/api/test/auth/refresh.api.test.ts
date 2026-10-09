import { randomUUID } from 'node:crypto';

import { TokenPair } from '@quad/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecordingDelivery } from '../fakes/delivery';
import { Browser } from '../helpers/browser';
import { useDatabaseApp } from '../helpers/database-app';
import { insertSchool, insertWebSession } from '../helpers/identity';
import {
  bearer,
  claimsOf,
  familyIdOf,
  familyRow,
  insertParentMember,
  insertPhoneAccount,
  signedInParent,
} from '../helpers/parent';

const NOW = Date.UTC(2026, 9, 9, 3, 30, 1);
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
let clock = NOW;
const delivery = new RecordingDelivery();
const { db, app } = useDatabaseApp({}, { overrides: { now: () => clock, delivery } });

beforeEach(() => {
  clock = NOW;
});

const refresh = (body: unknown) => new Browser(app).post('/auth/refresh', body);
const me = (accessToken: string) => new Browser(app).get('/me', { headers: bearer(accessToken) });

/** A guardian of one school, signed in on a phone. */
async function parentFamily() {
  const school = await insertSchool(db(), { name: 'Colombo International School' });
  const account = await insertPhoneAccount(db());
  const userId = await insertParentMember(db(), school.id, account.id);
  const pair = await signedInParent(app, delivery, account.phone);
  return { school, account, userId, pair, sessionId: familyIdOf(pair.refreshToken) };
}

/** Replaces the secret with a well-formed one the server never issued. */
const forged = (refreshToken: string, generation?: number) => {
  const [sessionId, current] = refreshToken.split('.');
  return `${sessionId}.${generation ?? current}.${'A'.repeat(86)}`;
};

describe('POST /auth/refresh (spec 05: rotating refresh families)', () => {
  it('rotates: a new pair for the same school, the next generation, and the old access token still valid', async () => {
    const { school, userId, pair, sessionId } = await parentFamily();
    const before = await familyRow(db(), sessionId);
    clock = NOW + 14 * MINUTE;

    const response = await refresh({ refreshToken: pair.refreshToken });

    expect(response.statusCode).toBe(200);
    const next = TokenPair.parse(response.json());
    expect(next.refreshToken).toMatch(new RegExp(`^${sessionId}\\.1\\.`));
    expect(claimsOf(next.accessToken)).toMatchObject({
      scope: 'tenant',
      tid: school.id,
      sub: userId,
      sid: sessionId,
      iat: (NOW + 14 * MINUTE) / 1000,
    });
    const after = await familyRow(db(), sessionId);
    expect(after.refresh_generation).toBe(1);
    expect(after.refresh_hash?.equals(before.refresh_hash ?? Buffer.alloc(0))).toBe(false);
    expect((await me(next.accessToken)).statusCode).toBe(200);
  });

  it('keeps rotating along the chain', async () => {
    const { pair } = await parentFamily();
    let current = pair;
    for (let generation = 1; generation <= 3; generation += 1) {
      const response = await refresh({ refreshToken: current.refreshToken });
      expect(response.statusCode).toBe(200);
      current = TokenPair.parse(response.json());
      expect(current.refreshToken.split('.')[1]).toBe(String(generation));
    }
  });

  it('revokes the whole family when a rotated-out token comes back (Review Focus #6)', async () => {
    const { pair, sessionId } = await parentFamily();
    const rotated = TokenPair.parse((await refresh({ refreshToken: pair.refreshToken })).json());
    expect((await me(rotated.accessToken)).statusCode).toBe(200);

    const reused = await refresh({ refreshToken: pair.refreshToken });

    expect(reused.statusCode).toBe(401);
    expect((await familyRow(db(), sessionId)).revoked_at).not.toBeNull();
    // The newest token and its access token are dead too.
    expect((await refresh({ refreshToken: rotated.refreshToken })).statusCode).toBe(401);
    expect((await me(rotated.accessToken)).statusCode).toBe(401);
    expect((await me(pair.accessToken)).statusCode).toBe(401);
  });

  it('lets only one of two concurrent refreshes with the same token succeed (the row is locked)', async () => {
    const { pair, sessionId } = await parentFamily();
    // Hold the family row so both refreshes are in flight at once, then let them go.
    const blocker = await db().platform.connect();
    try {
      await blocker.query('begin');
      await blocker.query('select 1 from sessions where id = $1 for update', [sessionId]);
      const racing = Promise.all([
        refresh({ refreshToken: pair.refreshToken }),
        refresh({ refreshToken: pair.refreshToken }),
      ]);
      await vi.waitFor(
        async () => {
          const { rows } = await db().platform.query<{ blocked: number }>(
            `select count(*)::int as blocked from pg_stat_activity
             where datname = current_database() and cardinality(pg_blocking_pids(pid)) > 0`,
          );
          expect(rows[0]?.blocked).toBe(2);
        },
        { timeout: 5000 },
      );
      await blocker.query('commit');
      const responses = await racing;

      expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 401]);
      // The second waited for the first, then saw a rotated-out generation: reuse.
      expect((await familyRow(db(), sessionId)).revoked_at).not.toBeNull();
    } finally {
      blocker.release();
    }
  });

  it('refuses a family older than 60 days with 401 (it still rotates on day 59)', async () => {
    const { pair } = await parentFamily();
    clock = NOW + 59 * DAY;
    const day59 = await refresh({ refreshToken: pair.refreshToken });
    expect(day59.statusCode).toBe(200);
    clock = NOW + 60 * DAY;
    const day60 = await refresh({ refreshToken: TokenPair.parse(day59.json()).refreshToken });
    expect(day60.statusCode).toBe(401);
  });

  it.each([
    ['no token', {}],
    ['a malformed token', { refreshToken: 'not-a-token' }],
    ['a token with no generation', { refreshToken: `${randomUUID()}.${'A'.repeat(86)}` }],
  ])('answers 400 validation for %s', async (_case, body) => {
    const response = await refresh(body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'validation' });
  });

  it('refuses a forged secret with 401 and revokes nothing (a forgery cannot sign anyone out)', async () => {
    const { pair, sessionId } = await parentFamily();
    const rotated = TokenPair.parse((await refresh({ refreshToken: pair.refreshToken })).json());

    expect((await refresh({ refreshToken: forged(rotated.refreshToken) })).statusCode).toBe(401);
    // An older generation with a secret the server never issued is not reuse either.
    expect((await refresh({ refreshToken: forged(rotated.refreshToken, 0) })).statusCode).toBe(401);
    // A generation the family has not reached.
    expect((await refresh({ refreshToken: forged(rotated.refreshToken, 7) })).statusCode).toBe(401);

    expect((await familyRow(db(), sessionId)).revoked_at).toBeNull();
    expect((await refresh({ refreshToken: rotated.refreshToken })).statusCode).toBe(200);
  });

  it('answers 401 for an unknown family and for a staff browser session id', async () => {
    const { pair } = await parentFamily();
    const unknown = `${randomUUID()}.0.${pair.refreshToken.split('.')[2] ?? ''}`;
    expect((await refresh({ refreshToken: unknown })).statusCode).toBe(401);
    const school = await insertSchool(db());
    const staff = await insertPhoneAccount(db());
    const staffUser = await insertParentMember(db(), school.id, staff.id, 'staff');
    const web = await insertWebSession(db(), staff.id, { tenantId: school.id, userId: staffUser });
    expect((await refresh({ refreshToken: forged(`${web.id}.0.x`) })).statusCode).toBe(401);
  });

  describe('rate limits (Task 9 fix round 1: per family, not per IP)', () => {
    it('allows 10 refreshes a minute per family and answers the 11th with 429 and Retry-After', async () => {
      const { pair } = await parentFamily();
      let current = pair;
      for (let count = 0; count < 10; count += 1) {
        const response = await refresh({ refreshToken: current.refreshToken });
        expect(response.statusCode).toBe(200);
        current = TokenPair.parse(response.json());
      }
      const eleventh = await refresh({ refreshToken: current.refreshToken });
      expect(eleventh.statusCode).toBe(429);
      expect(eleventh.headers['retry-after']).toBe(String(60 - ((NOW / 1000) % 60)));
      clock = NOW + 60 * 1000;
      expect((await refresh({ refreshToken: current.refreshToken })).statusCode).toBe(200);
    });

    it('never counts a forged token against the family it names', async () => {
      const { pair } = await parentFamily();
      for (let count = 0; count < 12; count += 1) {
        expect((await refresh({ refreshToken: forged(pair.refreshToken) })).statusCode).toBe(401);
      }
      expect((await refresh({ refreshToken: pair.refreshToken })).statusCode).toBe(200);
    });

    it('is not in the per-IP sign-in bucket: 25 phones behind one address all refresh', async () => {
      const families = [];
      for (let count = 0; count < 25; count += 1) families.push(await parentFamily());
      const browser = new Browser(app);
      for (const family of families) {
        const response = await browser.post('/auth/refresh', {
          refreshToken: family.pair.refreshToken,
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });

  it('answers 401 once the membership is deactivated', async () => {
    const { pair, userId } = await parentFamily();
    await db().platform.query(`update users set status = 'deactivated' where id = $1`, [userId]);
    expect((await refresh({ refreshToken: pair.refreshToken })).statusCode).toBe(401);
  });

  describe('a refresh token from school A never reaches school B', () => {
    it('refuses a refresh that names a school (400), and a rotation stays in A', async () => {
      const a = await parentFamily();
      const b = await insertSchool(db());
      await insertParentMember(db(), b.id, a.account.id);

      const named = await refresh({ refreshToken: a.pair.refreshToken, tenantId: b.id });
      expect(named.statusCode).toBe(400);

      const rotated = TokenPair.parse(
        (await refresh({ refreshToken: a.pair.refreshToken })).json(),
      );
      expect(claimsOf(rotated.accessToken).tid).toBe(a.school.id);
    });

    it('is not a bearer token: select-school with it answers 401', async () => {
      const a = await parentFamily();
      const b = await insertSchool(db());
      await insertParentMember(db(), b.id, a.account.id);
      const response = await new Browser(app).post(
        '/auth/select-school',
        { tenantId: b.id },
        { headers: bearer(a.pair.refreshToken) },
      );
      expect(response.statusCode).toBe(401);
    });
  });
});
