import { Buffer } from 'node:buffer';
import { createHmac, randomBytes } from 'node:crypto';

import { stackSecrets } from './stack-secrets';

/**
 * Signed links made by hand, for journey 43 (Task 26): an expired link is one signed with an
 * `exp` in the past, and a wrong-purpose link is a correctly signed link for another purpose.
 * The stack has no fake clock (Task 18), so this is how a spec gets them. The format is the
 * API's (`SignedLinks`, D16, D32): `base64url(JSON payload).base64url(HMAC-SHA256(payload
 * segment))` keyed by `LINK_SIGNING_SECRET`, the local one from `.env.example` that the stack
 * runs with. `apps/api/test/crypto/signed-token-helper.test.ts` checks the API reads them so.
 */

export interface TestLinkPayload {
  /** A `SignedLinkPurpose` (contracts), or any other text for a wrong-purpose link. */
  readonly purpose: string;
  /** The school, or null for an account-level `password_reset`. */
  readonly tid: string | null;
  readonly sub: string;
  /** Seconds since the epoch, or null for a link that never expires. */
  readonly exp: number | null;
  /** A fresh 128-bit nonce when left out. */
  readonly nonce?: string;
}

/** Signs `payload` exactly as the API does, with `secret` (the stack's by default). */
export function signTestLink(
  payload: TestLinkPayload,
  secret: string = stackSecrets().linkSigningSecret,
): string {
  const body = {
    purpose: payload.purpose,
    tid: payload.tid,
    sub: payload.sub,
    exp: payload.exp,
    nonce: payload.nonce ?? randomBytes(16).toString('base64url'),
  };
  const segment = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const mac = createHmac('sha256', secret).update(segment, 'ascii').digest('base64url');
  return `${segment}.${mac}`;
}

/** A correctly signed link that expired `secondsAgo` seconds before `now` (an hour by default). */
export function expiredTestLink(
  payload: Omit<TestLinkPayload, 'exp'>,
  { now = new Date(), secondsAgo = 3600 }: { now?: Date; secondsAgo?: number } = {},
): string {
  return signTestLink({ ...payload, exp: Math.floor(now.getTime() / 1000) - secondsAgo });
}

/** A link whose payload was changed after it was signed (`sub` gets a suffix). */
export function tamperedTestLink(payload: TestLinkPayload): string {
  const nonce = payload.nonce ?? randomBytes(16).toString('base64url');
  const [, mac] = signTestLink({ ...payload, nonce }).split('.');
  const [segment] = signTestLink({ ...payload, nonce, sub: `${payload.sub}-changed` }).split('.');
  return `${segment ?? ''}.${mac ?? ''}`;
}
