import { createHmac, hkdfSync } from 'node:crypto';

import type { Redis } from 'ioredis';

/** What one counted request learns: whether it may go on, and if not, how long to wait. */
export interface RateLimitResult {
  readonly allowed: boolean;
  /** Whole seconds until the window resets; 0 when allowed. */
  readonly retryAfter: number;
}

/**
 * Counts one hit in the window key and starts the key's expiry on the first hit, atomically, so
 * a key never outlives its window. Returns the count including this hit.
 */
const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

const KEY_PREFIX = 'quad:rl:';
/** HKDF `info` for the subject key, so it never equals another key made from SESSION_SECRET. */
const SUBJECT_KEY_INFO = 'quad rate-limit subject';

/**
 * Redis fixed-window rate limits (spec 06 → Rate limits). Windows are aligned to the epoch
 * (`floor(now / window)`), so a window resets on a fixed clock and `now` decides everything:
 * tests pass a fixed clock.
 */
export class RateLimitService {
  private readonly subjectKey: Buffer;

  constructor(
    private readonly redis: Redis,
    sessionSecret: string,
  ) {
    this.subjectKey = Buffer.from(hkdfSync('sha256', sessionSecret, '', SUBJECT_KEY_INFO, 32));
  }

  /**
   * Counts a request for `key` at `now` (epoch milliseconds) against `limit` per `windowSeconds`.
   * Throws when Redis cannot answer; the caller decides whether to fail open.
   */
  async hit(
    key: string,
    limit: number,
    windowSeconds: number,
    now: number,
  ): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const window = Math.floor(now / windowMs);
    const count = await this.redis.eval(
      FIXED_WINDOW_SCRIPT,
      1,
      `${KEY_PREFIX}${key}:${window}`,
      String(windowMs),
    );
    if (typeof count !== 'number') {
      throw new Error('The rate-limit script returned something other than a count.');
    }
    if (count <= limit) return { allowed: true, retryAfter: 0 };
    return { allowed: false, retryAfter: Math.ceil(((window + 1) * windowMs - now) / 1000) };
  }

  /**
   * A keyed hash (HMAC-SHA256, base64url) of a subject such as an email address or phone number,
   * so rate-limit keys never hold the raw value (ruling F65). The key is derived from
   * `SESSION_SECRET` with HKDF.
   */
  hashSubject(subject: string): string {
    return createHmac('sha256', this.subjectKey).update(subject, 'utf8').digest('base64url');
  }
}
