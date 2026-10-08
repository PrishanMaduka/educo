import { createHash, randomBytes } from 'node:crypto';

import { accounts, credentials, sessions, tenants, trustedDevices, uuidv7 } from '../src/internal';

import type {
  Account,
  AccountRunner,
  NewAccount,
  NewCredential,
  NewSession,
  NewTenant,
  NewTrustedDevice,
  PlatformRunner,
  Session,
  Tenant,
  TrustedDevice,
} from '../src/internal';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A random SHA-256 digest, the shape every stored token hash has. */
export function randomTokenHash(): Buffer {
  return createHash('sha256').update(randomBytes(32)).digest();
}

/** A valid `tenants` row with a unique id and slug; override any column. */
export function buildTenant(overrides: Partial<NewTenant> = {}): NewTenant {
  const suffix = randomBytes(4).toString('hex');
  return {
    id: uuidv7(),
    name: `Test School ${suffix}`,
    shortName: 'TS',
    slug: `test-${suffix}`,
    country: 'LK',
    region: 'ap-south',
    timeZone: 'Asia/Colombo',
    currency: 'LKR',
    locale: 'en-LK',
    status: 'active',
    ...overrides,
  };
}

/** Inserts a tenant through `withPlatform` (tenants is a platform table). */
export async function insertTenant(
  withPlatform: PlatformRunner,
  overrides: Partial<NewTenant> = {},
): Promise<Tenant> {
  const [row] = await withPlatform((tx) =>
    tx.insert(tenants).values(buildTenant(overrides)).returning(),
  );
  if (!row) {
    throw new Error('Tenant insert returned no row.');
  }
  return row;
}

/** A valid `accounts` row with a unique id and a fictional `.test` email; override any column. */
export function buildAccount(overrides: Partial<NewAccount> = {}): NewAccount {
  return {
    id: uuidv7(),
    email: `person-${randomBytes(4).toString('hex')}@example.test`,
    status: 'active',
    ...overrides,
  };
}

/** Inserts an account under its own `withAccount` scope (accounts RLS keys on `id`). */
export async function insertAccount(
  withAccount: AccountRunner,
  overrides: Partial<NewAccount> = {},
): Promise<Account> {
  const values = buildAccount(overrides);
  const accountId = values.id ?? uuidv7();
  const [row] = await withAccount(accountId, (tx) =>
    tx
      .insert(accounts)
      .values({ ...values, id: accountId })
      .returning(),
  );
  if (!row) {
    throw new Error('Account insert returned no row.');
  }
  return row;
}

/** Inserts the account's `credentials` row (no password, no authenticator unless overridden). */
export async function insertCredentials(
  withAccount: AccountRunner,
  accountId: string,
  overrides: Partial<NewCredential> = {},
): Promise<void> {
  await withAccount(accountId, (tx) => tx.insert(credentials).values({ accountId, ...overrides }));
}

/** A valid web `sessions` row for `accountId`, expiring in 12 hours; override any column. */
export function buildSession(accountId: string, overrides: Partial<NewSession> = {}): NewSession {
  return {
    id: uuidv7(),
    accountId,
    kind: 'web',
    stage: 'choose_school',
    tokenHash: randomTokenHash(),
    expiresAt: new Date(Date.now() + DAY_MS / 2),
    ...overrides,
  };
}

/** Inserts a session for `accountId` under that account's `withAccount` scope. */
export async function insertSession(
  withAccount: AccountRunner,
  accountId: string,
  overrides: Partial<NewSession> = {},
): Promise<Session> {
  const [row] = await withAccount(accountId, (tx) =>
    tx.insert(sessions).values(buildSession(accountId, overrides)).returning(),
  );
  if (!row) {
    throw new Error('Session insert returned no row.');
  }
  return row;
}

/** Inserts a trusted device for `accountId`, expiring in 30 days. */
export async function insertTrustedDevice(
  withAccount: AccountRunner,
  accountId: string,
  overrides: Partial<NewTrustedDevice> = {},
): Promise<TrustedDevice> {
  const [row] = await withAccount(accountId, (tx) =>
    tx
      .insert(trustedDevices)
      .values({
        accountId,
        tokenHash: randomTokenHash(),
        expiresAt: new Date(Date.now() + 30 * DAY_MS),
        ...overrides,
      })
      .returning(),
  );
  if (!row) {
    throw new Error('Trusted device insert returned no row.');
  }
  return row;
}
