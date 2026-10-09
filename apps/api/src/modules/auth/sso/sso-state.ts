import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

import { SsoProvider } from '@quad/contracts';
import { z } from 'zod';

/** How long a person may spend at the provider between start and callback. */
export const SSO_STATE_TTL_SECONDS = 10 * 60;

/** What the browser carries between `POST /auth/sso/:provider/start` and the callback. */
export interface SsoState {
  readonly provider: SsoProvider;
  /** The OAuth `state` sent to the provider, which must come back unchanged. */
  readonly state: string;
  /** The OIDC `nonce` the ID token must carry. */
  readonly nonce: string;
  /** The PKCE code verifier; only its S256 challenge went to the provider. */
  readonly verifier: string;
  readonly keepSignedIn: boolean;
}

/** An opened cookie: the state, plus what makes it single use. */
export interface OpenedSsoState extends SsoState {
  /** A random id the callback records once (`consume_signed_token`), so a copy fails. */
  readonly jti: string;
  readonly expiresAt: Date;
}

const JTI_BYTES = 16;

const Payload = z
  .object({
    p: SsoProvider,
    s: z.string().min(1).max(512),
    n: z.string().min(1).max(512),
    v: z.string().min(43).max(128),
    k: z.boolean(),
    j: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    exp: z.number().int(),
  })
  .strict();

const SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * The SSO state cookie (Task 8, D32): `base64url(payload).base64url(HMAC-SHA256)` under a key
 * derived by HKDF from `SESSION_SECRET` for this purpose only, with a 10-minute expiry inside the
 * payload (the cookie's own max-age is only a hint to the browser), and a random `jti` the
 * callback records once, so a copied cookie cannot be used again. The cookie ties the callback
 * to the browser that started: a callback URL opened anywhere else has no cookie and fails.
 */
export class SsoStateCookies {
  private readonly key: Buffer;

  constructor(sessionSecret: string) {
    this.key = Buffer.from(hkdfSync('sha256', sessionSecret, '', 'quad:sso-state', 32));
  }

  /** The cookie value for `state`, valid for `SSO_STATE_TTL_SECONDS` from `now`. */
  seal(state: SsoState, now: Date): string {
    const payload: z.infer<typeof Payload> = {
      p: state.provider,
      s: state.state,
      n: state.nonce,
      v: state.verifier,
      k: state.keepSignedIn,
      j: randomBytes(JTI_BYTES).toString('base64url'),
      exp: Math.floor(now.getTime() / 1000) + SSO_STATE_TTL_SECONDS,
    };
    const segment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${segment}.${this.mac(segment)}`;
  }

  /** The state in a cookie this API signed that has not expired at `now`; otherwise null. */
  open(value: string | undefined, now: Date): OpenedSsoState | null {
    const [segment, signature, ...rest] = (value ?? '').split('.');
    if (
      segment === undefined ||
      signature === undefined ||
      rest.length > 0 ||
      !SEGMENT.test(segment) ||
      !SEGMENT.test(signature)
    ) {
      return null;
    }
    const given = Buffer.from(signature, 'ascii');
    const expected = Buffer.from(this.mac(segment), 'ascii');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    let json: unknown;
    try {
      json = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    const parsed = Payload.safeParse(json);
    if (!parsed.success || parsed.data.exp * 1000 <= now.getTime()) return null;
    const { p, s, n, v, k, j, exp } = parsed.data;
    return {
      provider: p,
      state: s,
      nonce: n,
      verifier: v,
      keepSignedIn: k,
      jti: j,
      expiresAt: new Date(exp * 1000),
    };
  }

  private mac(segment: string): string {
    return createHmac('sha256', this.key).update(segment, 'ascii').digest('base64url');
  }
}

/** Compares the `state` that came back with the one in the cookie, in constant time. */
export function sameState(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
