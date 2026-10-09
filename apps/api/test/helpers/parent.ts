import { randomBytes, randomInt, randomUUID } from 'node:crypto';

import { OtpVerifyResult, TokenPair } from '@quad/contracts';
import { decodeJwt } from 'jose';

import { Browser } from './browser';
import { insertMember } from './identity';

import type { RecordingDelivery } from '../fakes/delivery';
import type { RecordingOtpSends } from '../fakes/otp-sends';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { MembershipKind } from '@quad/contracts';
import type { TestDatabase } from '@quad/db/testing';

/**
 * Arranges parent (guardian and relative) sign-in data for the token tests, with plain SQL
 * through `quad_platform` (BYPASSRLS): the arrangement step only. Numbers are fictional +94 77 0…
 * numbers in the documented range, never real ones.
 */

let nextPhone = randomInt(0, 900_000);

/** A fresh fictional Sri Lankan mobile number, `+94 77 0xx xxxx`, unique in this test file. */
export function freshPhone(): string {
  nextPhone = (nextPhone + 1) % 1_000_000;
  return `+94770${String(nextPhone).padStart(6, '0')}`;
}

/** The same number as a person types it: `+94 77 0xx xxxx`. */
export const spaced = (phone: string): string =>
  `${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;

export interface ParentAccount {
  readonly id: string;
  readonly phone: string;
  readonly email: string;
}

export async function insertPhoneAccount(
  db: TestDatabase,
  options: { readonly status?: 'active' | 'locked' | 'disabled'; readonly lockedUntil?: Date } = {},
): Promise<ParentAccount> {
  const id = randomUUID();
  const phone = freshPhone();
  const email = `parent-${randomBytes(4).toString('hex')}@example.test`;
  await db.platform.query(
    `insert into accounts (id, email, phone_e164, status, locked_until) values ($1, $2, $3, $4, $5)`,
    [id, email, phone, options.status ?? 'active', options.lockedUntil ?? null],
  );
  return { id, phone, email };
}

/** A guardian (or relative, or staff) membership of `accountId` in `tenantId`. */
export function insertParentMember(
  db: TestDatabase,
  tenantId: string,
  accountId: string,
  kind: MembershipKind = 'guardian',
  name = 'Dilhani Perera',
): Promise<string> {
  return insertMember(db, tenantId, accountId, { kind, name });
}

/** `Authorization: Bearer <token>`. */
export const bearer = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
});

/** The code in the latest sign-in SMS queued to `phone`. */
export function smsCode(delivery: RecordingDelivery, phone: string): string {
  const sms = delivery.sms.filter(({ job }) => job.to === phone).at(-1);
  const code = sms?.job.params.code;
  if (typeof code !== 'string') throw new Error('No sign-in SMS was queued.');
  return code;
}

/** The code in the latest sign-in email queued to `email`. */
export function emailCode(delivery: RecordingDelivery, email: string): string {
  const queued = delivery.emails
    .filter(({ job }) => job.to === email && job.template === 'email_otp')
    .at(-1);
  const code = queued?.job.params.code;
  if (typeof code !== 'string') throw new Error('No sign-in email was queued.');
  return code;
}

/** A code that is not `code` (for wrong-code tests). */
export const otherCode = (code: string): string =>
  String((Number(code) + 1) % 1_000_000).padStart(6, '0');

/** Asks for a code (the worker then sends it) and signs in with it, as the parent app does. */
export async function signInByPhone(
  app: () => NestFastifyApplication,
  sends: RecordingOtpSends,
  phone: string,
  browser: Browser = new Browser(app),
): Promise<OtpVerifyResult> {
  const requested = await browser.post('/auth/otp/request', { phone });
  if (requested.statusCode !== 202) throw new Error(`OTP request gave ${requested.statusCode}`);
  await sends.process(app());
  const verified = await browser.post('/auth/otp/verify', {
    phone,
    code: smsCode(sends.delivery, phone),
  });
  if (verified.statusCode !== 200) throw new Error(`OTP verify gave ${verified.statusCode}`);
  return OtpVerifyResult.parse(verified.json());
}

/** Signs in a parent with exactly one school and returns the pair. */
export async function signedInParent(
  app: () => NestFastifyApplication,
  sends: RecordingOtpSends,
  phone: string,
): Promise<TokenPair> {
  const result = await signInByPhone(app, sends, phone);
  if (result.status !== 'signed_in') throw new Error(`Expected signed_in, got ${result.status}`);
  return TokenPair.parse(result);
}

/** The claims of an access token (decoded only; the API verifies). */
export const claimsOf = (token: string): Record<string, unknown> => decodeJwt(token);

/** The family (`sessions` row) a refresh token names. */
export const familyIdOf = (refreshToken: string): string => refreshToken.split('.')[0] ?? '';

export interface FamilyRow {
  kind: string;
  stage: string;
  active_tenant_id: string | null;
  active_user_id: string | null;
  token_hash: Buffer | null;
  refresh_hash: Buffer | null;
  refresh_generation: number;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export async function familyRow(db: TestDatabase, sessionId: string): Promise<FamilyRow> {
  const { rows } = await db.platform.query<FamilyRow>(
    `select kind, stage, active_tenant_id, active_user_id, token_hash, refresh_hash,
            refresh_generation, created_at, expires_at, revoked_at
     from sessions where id = $1`,
    [sessionId],
  );
  const [row] = rows;
  if (row === undefined) throw new Error('No such family.');
  return row;
}
