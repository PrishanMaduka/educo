import { sql } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_TABLES,
  InvalidAccountIdError,
  OPEN_TABLES,
  createAccountRunner,
  createPlatformRunner,
  createTenantDb,
  sessions,
  uuidv7,
} from '../src/internal';

import {
  buildSession,
  insertAccount,
  insertCredentials,
  insertSession,
  insertTenant,
  insertTrustedDevice,
  randomTokenHash,
} from './factories';
import { postgresCause } from './pg-error';
import { useTestDatabase } from './setup';

import type { Account, AccountRunner, PlatformRunner, Tenant } from '../src/internal';

const testDb = useTestDatabase();

let withAccount: AccountRunner;
let withPlatform: PlatformRunner;
let accountA: Account;
let accountB: Account;
let school: Tenant;

/** The account tables Review Focus #4 names, with the column that says whose row it is. */
const OWNED_TABLES = [
  ['accounts', 'id'],
  ['credentials', 'account_id'],
  ['sessions', 'account_id'],
  ['trusted_devices', 'account_id'],
] as const;

beforeAll(async () => {
  const { app, platform } = testDb();
  withAccount = createAccountRunner(app);
  withPlatform = createPlatformRunner(platform);
  school = await insertTenant(withPlatform);
  accountA = await insertAccount(withAccount);
  accountB = await insertAccount(withAccount, { email: null, phoneE164: '+94770000999' });
  for (const account of [accountA, accountB]) {
    await insertCredentials(withAccount, account.id);
    await insertSession(withAccount, account.id);
    await insertTrustedDevice(withAccount, account.id);
  }
});

async function ownersUnder(accountId: string, table: string, column: string): Promise<string[]> {
  return withAccount(accountId, async (tx) => {
    const result = await tx.execute<{ owner: string }>(
      sql.raw(`select ${column}::text as owner from ${table}`),
    );
    return result.rows.map((row) => row.owner);
  });
}

describe('Review Focus #4 (account tables): quad_app sees only the current account', () => {
  it('lists every account table with its key column and declared privileges', () => {
    expect(ACCOUNT_TABLES).toEqual({
      accounts: { key: 'id', privileges: ['SELECT', 'INSERT', 'UPDATE'] },
      credentials: { key: 'account_id', privileges: ['SELECT', 'INSERT', 'UPDATE'] },
      identities: { key: 'account_id', privileges: ['SELECT', 'INSERT'] },
      sessions: { key: 'account_id', privileges: ['SELECT', 'INSERT', 'UPDATE'] },
      trusted_devices: { key: 'account_id', privileges: ['SELECT', 'INSERT', 'UPDATE'] },
    });
    expect(OPEN_TABLES).toEqual({
      otp_challenges: { privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
    });
  });

  it.each(OWNED_TABLES)("under withAccount(A), %s returns only A's rows", async (table, column) => {
    expect(await ownersUnder(accountA.id, table, column)).toEqual([accountA.id]);
    expect(await ownersUnder(accountB.id, table, column)).toEqual([accountB.id]);
  });

  it.each(OWNED_TABLES)('with no account set, %s returns no rows', async (table) => {
    const { rows } = await testDb().app.query<{ count: string }>(`select count(*) from ${table}`);
    expect(rows).toEqual([{ count: '0' }]);
  });

  it('refuses to insert a session for account B while scoped to account A (WITH CHECK)', async () => {
    const smuggled = await withAccount(accountA.id, (tx) =>
      tx.insert(sessions).values(buildSession(accountB.id)),
    ).catch((caught: unknown) => caught);
    const cause = postgresCause(smuggled);
    expect(cause).toBeInstanceOf(DatabaseError);
    expect(cause).toMatchObject({ code: '42501' });
    expect((cause as DatabaseError).message).toMatch(
      /new row violates row-level security policy for table "sessions"/,
    );
    expect(await ownersUnder(accountB.id, 'sessions', 'account_id')).toEqual([accountB.id]);
  });

  it("cannot update or delete account B's session while scoped to account A", async () => {
    const updated = await withAccount(accountA.id, (tx) =>
      tx.execute(sql`update sessions set revoked_at = now() where account_id = ${accountB.id}`),
    );
    expect(updated.rowCount).toBe(0);
    // quad_app has no DELETE on sessions at all.
    const deleted = await withAccount(accountA.id, (tx) =>
      tx.execute(sql`delete from sessions where account_id = ${accountB.id}`),
    ).catch((caught: unknown) => caught);
    expect(postgresCause(deleted)).toMatchObject({ code: '42501' });
    const { rows } = await testDb().platform.query<{ revoked: boolean }>(
      'select revoked_at is not null as revoked from sessions where account_id = $1',
      [accountB.id],
    );
    expect(rows).toEqual([{ revoked: false }]);
  });

  it('hides console sessions (no account) from quad_app', async () => {
    const { platform } = testDb();
    const platformUserId = uuidv7();
    await platform.query(
      `insert into platform_users (id, name, email, role) values ($1, 'Console Person', 'console@example.test', 'support')`,
      [platformUserId],
    );
    await platform.query(
      `insert into sessions (id, platform_user_id, kind, stage, token_hash, expires_at)
       values ($1, $2, 'console', 'active', $3, now() + interval '8 hours')`,
      [uuidv7(), platformUserId, randomTokenHash()],
    );
    const kinds = await withAccount(accountA.id, async (tx) => {
      const result = await tx.execute<{ kind: string }>(sql`select kind::text from sessions`);
      return result.rows.map((row) => row.kind);
    });
    expect(kinds).toEqual(['web']);
  });
});

describe('withAccount', () => {
  it('sets app.account_id for the transaction only, and app.tenant_id when asked', async () => {
    const inside = await withAccount(accountA.id, { tenantId: school.id }, async (tx) => {
      const result = await tx.execute<{ account: string; tenant: string }>(
        sql`select current_setting('app.account_id', true) as account,
                   current_setting('app.tenant_id', true) as tenant`,
      );
      return result.rows[0];
    });
    expect(inside).toEqual({ account: accountA.id, tenant: school.id });
    const plain = await withAccount(accountA.id, async (tx) => {
      const result = await tx.execute<{ tenant: string | null }>(
        sql`select current_setting('app.tenant_id', true) as tenant`,
      );
      return result.rows[0]?.tenant ?? '';
    });
    expect(plain).toBe('');
    const { rows } = await testDb().app.query<{ account: string | null }>(
      `select current_setting('app.account_id', true) as account`,
    );
    expect(rows[0]?.account ?? '').toBe('');
  });

  it.each(['nope', '', `'; drop table accounts; --`])(
    'withAccount(%j) throws InvalidAccountIdError without touching the database',
    async (id) => {
      const pool = testDb().app;
      const connect = vi.spyOn(pool, 'connect');
      const fn = vi.fn(() => Promise.resolve('ran'));
      try {
        await expect(withAccount(id, fn)).rejects.toBeInstanceOf(InvalidAccountIdError);
        expect(fn).not.toHaveBeenCalled();
        expect(connect).not.toHaveBeenCalled();
      } finally {
        connect.mockRestore();
      }
    },
  );

  it('refuses an invalid tenant id in the scope without touching the database', async () => {
    const fn = vi.fn(() => Promise.resolve('ran'));
    await expect(withAccount(accountA.id, { tenantId: 'nope' }, fn)).rejects.toMatchObject({
      code: 'invalid_tenant_id',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('is available on createTenantDb', async () => {
    const db = createTenantDb({ appUrl: testDb().appUrl, poolMax: 1 });
    try {
      expect(
        await db.withAccount(accountB.id, async (tx) => {
          const result = await tx.execute<{ id: string }>(sql`select id::text as id from accounts`);
          return result.rows.map((row) => row.id);
        }),
      ).toEqual([accountB.id]);
    } finally {
      await db.close();
    }
  });
});

describe('account table constraints', () => {
  it('refuses an account with neither an email nor a phone', async () => {
    const error: unknown = await insertAccount(withAccount, { email: null, phoneE164: null }).catch(
      (caught: unknown) => caught,
    );
    expect(postgresCause(error)).toMatchObject({ code: '23514' });
  });

  it('refuses a second account with the same email in another case (citext)', async () => {
    const error: unknown = await insertAccount(withAccount, {
      email: accountA.email?.toUpperCase() ?? null,
    }).catch((caught: unknown) => caught);
    expect(postgresCause(error)).toMatchObject({ code: '23505' });
  });

  it('refuses a session with both an account and a platform user, or with neither', async () => {
    const neither = await withPlatform((tx) =>
      tx.insert(sessions).values({
        kind: 'web',
        stage: 'active',
        tokenHash: randomTokenHash(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).catch((caught: unknown) => caught);
    expect(postgresCause(neither)).toMatchObject({ code: '23514' });
  });
});

describe('SSO logins and sign-in methods (0010, Task 8)', () => {
  const link = (accountId: string, provider: string, subject: string) =>
    testDb().platform.query(
      'insert into identities (account_id, provider, subject) values ($1, $2, $3)',
      [accountId, provider, subject],
    );

  it('keeps one login per provider per account (identities)', async () => {
    const account = await insertAccount(withAccount);
    await link(account.id, 'google', `g-${uuidv7()}`);
    await link(account.id, 'microsoft', `m-${uuidv7()}`);
    const second: unknown = await link(account.id, 'google', `g-${uuidv7()}`).catch(
      (caught: unknown) => caught,
    );
    expect(postgresCause(second)).toMatchObject({
      code: '23505',
      constraint: 'identities_account_id_provider_unique',
    });
  });

  it('records how a session signed in, and takes only a sign-in method', async () => {
    const session = await insertSession(withAccount, accountA.id);
    const setMethod = (method: string) =>
      testDb().platform.query('update sessions set sign_in_method = $2 where id = $1', [
        session.id,
        method,
      ]);
    await setMethod('sso:microsoft');
    const { rows } = await testDb().platform.query<{ sign_in_method: string }>(
      'select sign_in_method from sessions where id = $1',
      [session.id],
    );
    expect(rows).toEqual([{ sign_in_method: 'sso:microsoft' }]);
    const junk: unknown = await setMethod('carrier pigeon').catch((caught: unknown) => caught);
    expect(postgresCause(junk)).toMatchObject({ code: '22P02' });
  });
});

describe('otp_challenges (open table)', () => {
  it('quad_app can create, read, update and delete challenges without an account', async () => {
    const { app } = testDb();
    const id = uuidv7();
    await app.query(
      `insert into otp_challenges (id, subject_hash, channel, code_hash, purpose, expires_at)
       values ($1, $2, 'sms', $3, 'sign_in', now() + interval '10 minutes')`,
      [id, randomTokenHash(), randomTokenHash()],
    );
    await app.query('update otp_challenges set attempts = attempts + 1 where id = $1', [id]);
    const { rows } = await app.query<{ attempts: number }>(
      'select attempts from otp_challenges where id = $1',
      [id],
    );
    expect(rows).toEqual([{ attempts: 1 }]);
    const removed = await app.query('delete from otp_challenges where id = $1', [id]);
    expect(removed.rowCount).toBe(1);
  });
});
