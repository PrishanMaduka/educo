import { createHash } from 'node:crypto';

import type { Config } from '../../config';
import type { Logger } from 'pino';

/** Whether a password appears in a known breach (spec 05). */
export interface BreachCheck {
  isBreached(password: string): Promise<boolean>;
}

/** The k-anonymity range endpoint: only the first five hex characters of the SHA-1 are sent. */
export const PWNED_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

/** Fetches one range body (`SUFFIX:COUNT` lines); rejects on any non-2xx answer. */
export type PwnedRangeFetcher = (prefix: string, signal: AbortSignal) => Promise<string>;

/** The real fetcher. `Add-Padding` makes every answer a similar size, so the range stays private. */
export const fetchPwnedRange: PwnedRangeFetcher = async (prefix, signal) => {
  const response = await fetch(`${PWNED_RANGE_URL}${prefix}`, {
    headers: { 'Add-Padding': 'true' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`The range API answered ${response.status}.`);
  }
  return response.text();
};

/**
 * The range API with a time limit. It fails open: when the API errors or is slow, the password
 * is accepted and a `breach_check_unavailable` metric is logged (D32), because refusing every
 * password while a third party is down would lock people out of setting one.
 */
export class PwnedPasswordsBreachCheck implements BreachCheck {
  static readonly DEFAULT_TIMEOUT_MS = 2000;

  constructor(
    private readonly fetchRange: PwnedRangeFetcher,
    private readonly logger: Logger,
    private readonly timeoutMs: number = PwnedPasswordsBreachCheck.DEFAULT_TIMEOUT_MS,
  ) {}

  async isBreached(password: string): Promise<boolean> {
    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const signal = AbortSignal.timeout(this.timeoutMs);
    let body: string;
    try {
      body = await this.fetchRange(prefix, signal);
    } catch {
      // Never log the error itself: its message may carry the prefix.
      const reason = signal.aborted ? 'timeout' : 'error';
      this.logger.warn(
        { metric: 'breach_check_unavailable', reason },
        'The breached-password check was unavailable, so the password was accepted',
      );
      return false;
    }
    return body.split('\n').some((line) => {
      const [lineSuffix, count] = line.trim().split(':');
      return lineSuffix?.toUpperCase() === suffix && Number(count) > 0;
    });
  }
}

/**
 * The offline stand-in for tests and `APP_ENV=local` (OQ14), so nothing leaves the machine. It
 * knows a few common passwords that pass the length rule.
 */
export class OfflineBreachCheck implements BreachCheck {
  private static readonly KNOWN = new Set([
    'password123',
    'password1234',
    '1234567890',
    '0123456789',
    'qwertyuiop',
    'qwerty12345',
    'iloveyou123',
    '1q2w3e4r5t',
    'abcdefghij',
    'letmein1234',
  ]);

  isBreached(password: string): Promise<boolean> {
    return Promise.resolve(OfflineBreachCheck.KNOWN.has(password));
  }
}

/** The offline list locally; the range API in staging and production. */
export function createBreachCheck(
  appEnv: Config['APP_ENV'],
  logger: Logger,
  fetchRange: PwnedRangeFetcher = fetchPwnedRange,
): BreachCheck {
  return appEnv === 'local'
    ? new OfflineBreachCheck()
    : new PwnedPasswordsBreachCheck(fetchRange, logger);
}
