import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes and a 32-byte HMAC-SHA256: 86 base64url characters (`RefreshToken`). */
const RANDOM_BYTES = 32;
const KEY_INFO = 'quad:refresh';

/** A new refresh token, and the hash its family stores (`sessions.refresh_hash`). */
export interface IssuedRefreshToken {
  readonly token: string;
  readonly secretHash: Buffer;
}

/** What a presented refresh token says, before its family is read. */
export interface PresentedRefreshToken {
  readonly sessionId: string;
  readonly generation: number;
  /** SHA-256 of the secret, to compare with the family's current `refresh_hash`. */
  readonly secretHash: Buffer;
  /**
   * The secret carries the server's MAC over this family and generation: the token was issued,
   * so an older generation is real reuse (a forgery never revokes a family).
   */
  readonly issued: boolean;
}

const sha256 = (value: Buffer): Buffer => createHash('sha256').update(value).digest();

/**
 * The parent app's refresh tokens (spec 05; D32): `{sessionId}.{generation}.{secret}`, where the
 * secret is 32 random bytes followed by HMAC-SHA256 of `{sessionId}.{generation}.` and those
 * bytes, under a key derived by HKDF-SHA256 from `SESSION_SECRET` (info `quad:refresh`). The
 * family stores only the SHA-256 of the current secret: the database alone cannot mint a token,
 * and the key alone cannot pass the current generation's check.
 */
export class RefreshTokens {
  private readonly key: Buffer;

  constructor(sessionSecret: string) {
    this.key = Buffer.from(hkdfSync('sha256', sessionSecret, '', KEY_INFO, 32));
  }

  issue(sessionId: string, generation: number): IssuedRefreshToken {
    const random = randomBytes(RANDOM_BYTES);
    const secret = Buffer.concat([random, this.mac(sessionId, generation, random)]);
    return {
      token: `${sessionId}.${generation}.${secret.toString('base64url')}`,
      secretHash: sha256(secret),
    };
  }

  /** Reads a token already shaped like `RefreshToken` (the contract checks the format). */
  read(token: string): PresentedRefreshToken {
    const [sessionId = '', generation = '', encoded = ''] = token.split('.');
    const secret = Buffer.from(encoded, 'base64url');
    const random = secret.subarray(0, RANDOM_BYTES);
    const tag = secret.subarray(RANDOM_BYTES);
    const expected = this.mac(sessionId, Number(generation), random);
    // Only the canonical encoding counts, so one secret has exactly one spelling.
    const issued =
      secret.toString('base64url') === encoded &&
      tag.length === expected.length &&
      timingSafeEqual(tag, expected);
    return { sessionId, generation: Number(generation), secretHash: sha256(secret), issued };
  }

  private mac(sessionId: string, generation: number, random: Buffer): Buffer {
    return createHmac('sha256', this.key)
      .update(`${sessionId}.${generation}.`)
      .update(random)
      .digest();
  }
}

/** Whether the presented secret is the family's current one (constant time). */
export function isCurrentSecret(stored: Buffer | null, presented: Buffer): boolean {
  return (
    stored !== null && stored.length === presented.length && timingSafeEqual(stored, presented)
  );
}
