import { randomBytes, randomUUID } from 'node:crypto';

import { hashSessionToken, newSessionToken } from '../../src/common/session/cookies';
import { CsrfTokens } from '../../src/common/session/csrf';
import { localEnv } from '../env';

import type { MembershipKind, MembershipStatus, SessionStage, TenantStatus } from '@quad/contracts';
import type { TestDatabase } from '@quad/db/testing';

/**
 * Seeds schools, people and sessions for the API's integration tests, with plain SQL through the
 * test database's `quad_platform` pool (BYPASSRLS): the arrangement step only, never the code
 * under test. Every name and address is fictional.
 */

const HOUR_MS = 60 * 60 * 1000;
const csrfTokens = new CsrfTokens(localEnv().SESSION_SECRET ?? '');

const suffix = () => randomBytes(4).toString('hex');

export interface SchoolSeed {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
}

export async function insertSchool(
  db: TestDatabase,
  options: {
    readonly name?: string;
    readonly shortName?: string;
    readonly status?: TenantStatus;
    readonly suspendReason?: string;
    readonly brandColor?: string;
    readonly sessionHours?: number;
    readonly timeZone?: string;
  } = {},
): Promise<SchoolSeed> {
  const id = randomUUID();
  const name = options.name ?? `Test School ${suffix()}`;
  const shortName = options.shortName ?? 'TS';
  await db.platform.query(
    `insert into tenants (id, name, short_name, slug, country, region, time_zone, currency, locale, status, suspend_reason)
     values ($1, $2, $3, $4, 'LK', 'ap-south', $5, 'LKR', 'en-LK', $6, $7)`,
    [
      id,
      name,
      shortName,
      `test-${suffix()}`,
      options.timeZone ?? 'Asia/Colombo',
      options.status ?? 'active',
      options.suspendReason ?? null,
    ],
  );
  if (options.brandColor !== undefined) {
    await db.platform.query(
      'insert into tenant_branding (tenant_id, brand_color) values ($1, $2)',
      [id, options.brandColor],
    );
  }
  if (options.sessionHours !== undefined) {
    await db.platform.query(
      'insert into tenant_security (tenant_id, session_hours) values ($1, $2)',
      [id, options.sessionHours],
    );
  }
  return { id, name, shortName };
}

export async function setSchoolStatus(
  db: TestDatabase,
  tenantId: string,
  status: TenantStatus,
): Promise<void> {
  await db.platform.query('update tenants set status = $2 where id = $1', [tenantId, status]);
}

export async function insertAccount(db: TestDatabase): Promise<string> {
  const id = randomUUID();
  await db.platform.query(`insert into accounts (id, email, status) values ($1, $2, 'active')`, [
    id,
    `person-${suffix()}@example.test`,
  ]);
  return id;
}

export async function insertMember(
  db: TestDatabase,
  tenantId: string,
  accountId: string,
  options: {
    readonly name?: string;
    readonly kind?: MembershipKind;
    readonly status?: MembershipStatus;
  } = {},
): Promise<string> {
  const id = randomUUID();
  await db.platform.query(
    `insert into users (id, tenant_id, account_id, kind, name, status) values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      tenantId,
      accountId,
      options.kind ?? 'staff',
      options.name ?? `Test Person ${suffix()}`,
      options.status ?? 'active',
    ],
  );
  return id;
}

export async function insertRole(
  db: TestDatabase,
  tenantId: string,
  memberId: string,
  name: string,
): Promise<string> {
  const id = randomUUID();
  await db.platform.query(`insert into roles (id, tenant_id, key, name) values ($1, $2, $3, $4)`, [
    id,
    tenantId,
    `role_${suffix()}`,
    name,
  ]);
  await db.platform.query(
    `insert into user_roles (tenant_id, user_id, role_id, "primary") values ($1, $2, $3, true)`,
    [tenantId, memberId, id],
  );
  return id;
}

/** A session cookie: its token, the stored hash and the matching CSRF value. */
export interface SessionSeed {
  readonly id: string;
  readonly token: string;
  readonly tokenHash: Buffer;
  readonly csrf: string;
}

export async function insertWebSession(
  db: TestDatabase,
  accountId: string,
  options: {
    readonly tenantId?: string;
    readonly userId?: string;
    readonly stage?: SessionStage;
    readonly keepSignedIn?: boolean;
    readonly lastSeenAt?: Date;
    readonly expiresAt?: Date;
    readonly revokedAt?: Date;
    readonly userAgent?: string;
  } = {},
): Promise<SessionSeed> {
  const id = randomUUID();
  const token = newSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = Date.now();
  await db.platform.query(
    `insert into sessions (id, account_id, active_tenant_id, active_user_id, kind, stage, token_hash,
                           keep_signed_in, last_seen_at, expires_at, revoked_at, user_agent)
     values ($1, $2, $3, $4, 'web', $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      accountId,
      options.tenantId ?? null,
      options.userId ?? null,
      options.stage ?? (options.tenantId === undefined ? 'choose_school' : 'active'),
      tokenHash,
      options.keepSignedIn ?? false,
      options.lastSeenAt ?? new Date(now),
      options.expiresAt ?? new Date(now + 12 * HOUR_MS),
      options.revokedAt ?? null,
      options.userAgent ?? null,
    ],
  );
  return { id, token, tokenHash, csrf: csrfTokens.tokenFor(tokenHash) };
}

export async function insertPlatformUser(db: TestDatabase, name: string): Promise<string> {
  const id = randomUUID();
  await db.platform.query(
    `insert into platform_users (id, name, email, role) values ($1, $2, $3, 'support')`,
    [id, name, `staff-${suffix()}@example.test`],
  );
  return id;
}

/** A redeemed support visit (ruling R-support-token): its cookie hash on `support_sessions`. */
export async function insertSupportVisit(
  db: TestDatabase,
  platformUserId: string,
  tenantId: string,
  options: { readonly expiresAt?: Date } = {},
): Promise<SessionSeed> {
  const id = randomUUID();
  const token = newSessionToken();
  const tokenHash = hashSessionToken(token);
  await db.platform.query(
    `insert into support_sessions (id, platform_user_id, tenant_id, reason, expires_at, token_hash)
     values ($1, $2, $3, 'Helping with a test', $4, $5)`,
    [id, platformUserId, tenantId, options.expiresAt ?? new Date(Date.now() + HOUR_MS), tokenHash],
  );
  return { id, token, tokenHash, csrf: csrfTokens.tokenFor(tokenHash) };
}

/** The headers a browser sends with a staff session: both cookies, and the CSRF header. */
export function sessionHeaders(
  session: Pick<SessionSeed, 'token' | 'csrf'>,
  options: { readonly csrfHeader?: boolean } = {},
): Record<string, string> {
  return {
    cookie: `quad_sid=${session.token}; quad_csrf=${session.csrf}`,
    ...(options.csrfHeader === false ? {} : { 'x-csrf-token': session.csrf }),
  };
}

/** A staff member of `school` with an active session there. */
export async function signedInMember(
  db: TestDatabase,
  school: SchoolSeed,
  options: { readonly name?: string; readonly accountId?: string } = {},
): Promise<{ accountId: string; userId: string; session: SessionSeed }> {
  const accountId = options.accountId ?? (await insertAccount(db));
  const userId = await insertMember(db, school.id, accountId, {
    ...(options.name === undefined ? {} : { name: options.name }),
  });
  const session = await insertWebSession(db, accountId, { tenantId: school.id, userId });
  return { accountId, userId, session };
}
