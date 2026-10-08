import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

/** The header a page sends the CSRF cookie's value back in. */
export const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/** True for a method that can change something, so a cookie-authenticated call needs the token. */
export function needsCsrfToken(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Double-submit CSRF tokens (D32): the readable CSRF cookie holds HMAC-SHA256 of the session's
 * `token_hash`, under a key derived by HKDF from `SESSION_SECRET`, and every cookie-authenticated
 * write sends the same value in `X-CSRF-Token`. The server recomputes it from the session, so a
 * page on another site, which can neither read the cookie nor compute the value, cannot forge
 * the header. Bearer requests (the parent app) are exempt: no cookie rides along with them.
 */
export class CsrfTokens {
  private readonly key: Buffer;

  constructor(sessionSecret: string) {
    this.key = Buffer.from(hkdfSync('sha256', sessionSecret, '', 'quad:csrf', 32));
  }

  /** The value for the CSRF cookie of the session whose cookie hashes to `tokenHash`. */
  tokenFor(tokenHash: Buffer): string {
    return createHmac('sha256', this.key).update(tokenHash).digest('base64url');
  }

  /** True when `header` is this session's token (compared in constant time). */
  verify(tokenHash: Buffer, header: unknown): boolean {
    if (typeof header !== 'string') return false;
    const expected = Buffer.from(this.tokenFor(tokenHash));
    const given = Buffer.from(header);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
