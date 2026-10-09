import { randomBytes, randomUUID } from 'node:crypto';

import { createFieldCipher } from '@quad/db';
import { generateSecret } from 'otplib';
import { expect } from 'vitest';

import { PasswordHasher } from '../../src/common/crypto/passwords';
import { hashSessionToken, newSessionToken } from '../../src/common/session/cookies';
import { CsrfTokens } from '../../src/common/session/csrf';
import { localEnv } from '../env';

import { Browser } from './browser';
import { GOOD_PASSWORD, totpCode } from './sign-in';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AccountStatus, PlatformRole, SessionStage } from '@quad/contracts';
import type { TestDatabase } from '@quad/db/testing';

/**
 * Arranges console users and sessions for the platform tests with plain SQL through
 * `quad_platform`: the arrangement step only, never the code under test. Every name and address
 * is fictional, and every email is fresh, so per-email rate-limit buckets never fill across runs.
 */

const hasher = new PasswordHasher();
const cipher = createFieldCipher(localEnv().FIELD_ENCRYPTION_KEY ?? '');
const csrfTokens = new CsrfTokens(localEnv().SESSION_SECRET ?? '');
const HOUR_MS = 60 * 60 * 1000;

const suffix = () => randomBytes(4).toString('hex');

/** The console cookie names locally (no `__Host-` prefix on plain http). */
export const CONSOLE_SID = 'quad_console_sid';
export const CONSOLE_CSRF = 'quad_console_csrf';

export interface ConsoleUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly role: PlatformRole;
  /** The authenticator's base32 secret, when TOTP is on. */
  readonly totpSecret: string | null;
}

export async function insertConsoleUser(
  db: TestDatabase,
  options: {
    readonly role?: PlatformRole;
    readonly status?: AccountStatus;
    readonly totp?: boolean;
    readonly name?: string;
    readonly lockedUntil?: Date;
  } = {},
): Promise<ConsoleUser> {
  const id = randomUUID();
  const name = options.name ?? `Quad Staff ${suffix()}`;
  const email = `staff-${suffix()}@quad.test`;
  const role = options.role ?? 'owner';
  const totpSecret = options.totp === false ? null : generateSecret();
  await db.platform.query(
    `insert into platform_users (id, name, email, role, password_hash, totp_secret_enc, totp_enabled, status, locked_until)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      name,
      email,
      role,
      await hasher.hash(GOOD_PASSWORD),
      totpSecret === null ? null : await cipher.encrypt(totpSecret),
      totpSecret !== null,
      options.status ?? 'active',
      options.lockedUntil ?? null,
    ],
  );
  return { id, name, email, password: GOOD_PASSWORD, role, totpSecret };
}

/** A browser on the console: it echoes the console CSRF cookie, like the console web app. */
export function consoleBrowser(app: () => NestFastifyApplication): Browser {
  const browser = new Browser(app);
  browser.csrfCookie = CONSOLE_CSRF;
  return browser;
}

/** Signs `user` in through the API (password, then the authenticator code at `nowMs`). */
export async function signInToConsole(
  app: () => NestFastifyApplication,
  user: ConsoleUser,
  nowMs: number,
  browser: Browser = consoleBrowser(app),
): Promise<Browser> {
  if (user.totpSecret === null) throw new Error('The console user has no authenticator.');
  const password = await browser.post('/platform/auth/password', {
    email: user.email,
    password: user.password,
  });
  expect(password.json()).toEqual({ next: 'two_step' });
  const verify = await browser.post('/platform/auth/totp/verify', {
    code: await totpCode(user.totpSecret, nowMs),
  });
  expect(verify.json()).toEqual({ next: 'done' });
  return browser;
}

/** A console session row (for tests that need one without signing in, such as sockets). */
export async function insertConsoleSession(
  db: TestDatabase,
  platformUserId: string,
  options: { readonly stage?: SessionStage; readonly expiresAt?: Date } = {},
): Promise<{ readonly token: string; readonly csrf: string }> {
  const token = newSessionToken();
  const tokenHash = hashSessionToken(token);
  await db.platform.query(
    `insert into sessions (platform_user_id, kind, stage, token_hash, expires_at)
     values ($1, 'console', $2, $3, $4)`,
    [
      platformUserId,
      options.stage ?? 'active',
      tokenHash,
      options.expiresAt ?? new Date(Date.now() + 8 * HOUR_MS),
    ],
  );
  return { token, csrf: csrfTokens.tokenFor(tokenHash) };
}

export interface PlatformAuditRow {
  readonly actor_platform_user_id: string | null;
  readonly target_type: string | null;
  readonly target_id: string | null;
  readonly ip: string | null;
  readonly meta: Record<string, unknown>;
}

/** The `platform_audit` rows of one action about `targetId` (or with no target), oldest first. */
export async function platformAuditRows(
  db: TestDatabase,
  action: string,
  targetId: string | null,
): Promise<PlatformAuditRow[]> {
  const { rows } = await db.platform.query<PlatformAuditRow>(
    `select actor_platform_user_id, target_type, target_id, host(ip) as ip, meta
     from platform_audit
     where action = $1 and target_id is not distinct from $2
     order by at, id`,
    [action, targetId],
  );
  return rows;
}

/** The stored authenticator columns of a console user. */
export async function consoleTotpOf(
  db: TestDatabase,
  id: string,
): Promise<{ totpEnabled: boolean; secret: string | null; sealed: string | null }> {
  const { rows } = await db.platform.query<{
    totp_enabled: boolean;
    totp_secret_enc: string | null;
  }>('select totp_enabled, totp_secret_enc from platform_users where id = $1', [id]);
  const [row] = rows;
  if (row === undefined) throw new Error('No such console user.');
  const sealed = row.totp_secret_enc;
  return {
    totpEnabled: row.totp_enabled,
    sealed,
    secret: sealed === null ? null : await cipher.decrypt(sealed),
  };
}

export { totpCode };
