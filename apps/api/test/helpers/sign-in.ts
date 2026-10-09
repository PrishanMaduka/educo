import { randomBytes, randomUUID } from 'node:crypto';

import { createFieldCipher } from '@quad/db';
import { generate, generateSecret } from 'otplib';
import { expect } from 'vitest';

import { PasswordHasher } from '../../src/common/crypto/passwords';
import { localEnv } from '../env';

import type { RecordingDelivery } from '../fakes/delivery';
import type { AccountStatus, TwoStepRule } from '@quad/contracts';
import type { TestDatabase } from '@quad/db/testing';

/**
 * Arranges sign-in data for the auth tests with plain SQL through `quad_platform` (BYPASSRLS):
 * accounts with passwords, authenticators and recovery codes, and the schools' sign-in rules.
 * The arrangement step only, never the code under test. Every address is fictional.
 */

const hasher = new PasswordHasher();
const cipher = createFieldCipher(localEnv().FIELD_ENCRYPTION_KEY ?? '');

/** A password that passes the policy and is not on the offline breached list. */
export const GOOD_PASSWORD = 'correct horse battery staple';

const suffix = () => randomBytes(4).toString('hex');

/** A fresh fictional work email at `domain`. */
export const freshEmail = (domain = 'example.test') => `person-${suffix()}@${domain}`;

/**
 * A fresh value that is not an email. Per-email rate limits count even a malformed body email,
 * and test clocks are fixed, so a constant would fill its bucket after a few runs (429).
 */
export const malformedEmail = () => `not-an-email-${suffix()}`;

export interface PasswordAccount {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  /** The authenticator's base32 secret, when one is enabled. */
  readonly totpSecret: string | null;
  readonly recoveryCodes: readonly string[];
}

export async function insertPasswordAccount(
  db: TestDatabase,
  options: {
    readonly email?: string;
    readonly password?: string;
    readonly status?: AccountStatus;
    readonly lockedUntil?: Date;
    readonly totp?: boolean;
    readonly recoveryCodes?: readonly string[];
  } = {},
): Promise<PasswordAccount> {
  const id = randomUUID();
  const email = options.email ?? freshEmail();
  const password = options.password ?? GOOD_PASSWORD;
  const totpSecret = options.totp === true ? generateSecret() : null;
  const recoveryCodes = options.recoveryCodes ?? [];
  await db.platform.query(
    `insert into accounts (id, email, status, locked_until) values ($1, $2, $3, $4)`,
    [id, email, options.status ?? 'active', options.lockedUntil ?? null],
  );
  await db.platform.query(
    `insert into credentials (account_id, password_hash, totp_secret_enc, totp_enabled, recovery_codes_hash)
     values ($1, $2, $3, $4, $5)`,
    [
      id,
      await hasher.hash(password),
      totpSecret === null ? null : await cipher.encrypt(totpSecret),
      totpSecret !== null,
      await Promise.all(recoveryCodes.map((code) => hasher.hash(code))),
    ],
  );
  return { id, email, password, totpSecret, recoveryCodes };
}

/** The authenticator code for `secret` at `nowMs` (the app's clock). */
export function totpCode(secret: string, nowMs: number): Promise<string> {
  return generate({ secret, epoch: Math.floor(nowMs / 1000) });
}

/** Sets a school's two-step rule and password minimum. */
export async function setSignInRules(
  db: TestDatabase,
  tenantId: string,
  rules: { readonly twoStep?: TwoStepRule; readonly passwordMinLength?: number },
): Promise<void> {
  await db.platform.query(
    `insert into tenant_security (tenant_id, two_step, password_min_length)
     values ($1, $2, $3)
     on conflict (tenant_id) do update set two_step = excluded.two_step,
       password_min_length = excluded.password_min_length`,
    [tenantId, rules.twoStep ?? 'off', rules.passwordMinLength ?? 10],
  );
}

/** Gives a member a role with a given key (`admin` for the two-step `admins` rule). */
export async function insertRoleWithKey(
  db: TestDatabase,
  tenantId: string,
  memberId: string,
  key: string,
  name: string,
): Promise<void> {
  const id = randomUUID();
  await db.platform.query(
    `insert into roles (id, tenant_id, key, name, system) values ($1, $2, $3, $4, true)`,
    [id, tenantId, key, name],
  );
  await db.platform.query(
    `insert into user_roles (tenant_id, user_id, role_id, "primary") values ($1, $2, $3, true)`,
    [tenantId, memberId, id],
  );
}

/** The school audit rows of one action, oldest first. */
export async function auditRows(
  db: TestDatabase,
  action: string,
): Promise<{ tenant_id: string; actor_user_id: string | null; target_id: string | null }[]> {
  const { rows } = await db.platform.query<{
    tenant_id: string;
    actor_user_id: string | null;
    target_id: string | null;
  }>(
    `select tenant_id, actor_user_id, target_id from audit_log where action = $1 order by at, id`,
    [action],
  );
  return rows;
}

/** The emails queued to `to` with `template`. */
export function emailsTo(delivery: RecordingDelivery, to: string, template: string) {
  return delivery.emails.filter(({ job }) => job.to === to && job.template === template);
}

/** Any string, for `toMatchObject` (typed `unknown` so no `any` leaks into the object). */
export const anyText = (): unknown => expect.any(String);

/** A string containing `part`, for `toMatchObject`. */
export const textContaining = (part: string): unknown => expect.stringContaining(part);
