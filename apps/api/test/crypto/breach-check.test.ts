import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  OfflineBreachCheck,
  PWNED_RANGE_URL,
  PwnedPasswordsBreachCheck,
  createBreachCheck,
} from '../../src/common/crypto/breach-check';

import type { PwnedRangeFetcher } from '../../src/common/crypto/breach-check';
import type { Logger } from 'pino';

const PASSWORD = 'password123';
const SHA1 = createHash('sha1').update(PASSWORD).digest('hex').toUpperCase();
const PREFIX = SHA1.slice(0, 5);
const SUFFIX = SHA1.slice(5);

function fakeLogger() {
  const warn = vi.fn();
  return { warn, logger: { warn } as unknown as Logger };
}

/** A range body as the API sends it with Add-Padding: CRLF lines, padding rows with count 0. */
function rangeBody(lines: readonly string[]): string {
  return [...lines, '0000000000000000000000000000000000A:0'].join('\r\n');
}

describe('OfflineBreachCheck (tests and APP_ENV=local, OQ14)', () => {
  const check = new OfflineBreachCheck();

  it('flags password123', async () => {
    await expect(check.isBreached('password123')).resolves.toBe(true);
  });

  it('passes a password that is not on its list', async () => {
    await expect(check.isBreached('a quiet lantern by the lake')).resolves.toBe(false);
  });
});

describe('PwnedPasswordsBreachCheck (k-anonymity range API)', () => {
  it('sends only the first five characters of the SHA-1 to the range endpoint', async () => {
    const fetcher = vi.fn<PwnedRangeFetcher>(() => Promise.resolve(rangeBody([])));
    await new PwnedPasswordsBreachCheck(fetcher, fakeLogger().logger).isBreached(PASSWORD);
    expect(fetcher).toHaveBeenCalledWith(PREFIX, expect.any(AbortSignal));
    expect(PWNED_RANGE_URL).toBe('https://api.pwnedpasswords.com/range/');
  });

  it('flags a password whose suffix appears with a count', async () => {
    const fetcher: PwnedRangeFetcher = () => Promise.resolve(rangeBody([`${SUFFIX}:251682`]));
    const check = new PwnedPasswordsBreachCheck(fetcher, fakeLogger().logger);
    await expect(check.isBreached(PASSWORD)).resolves.toBe(true);
  });

  it('matches the suffix case-insensitively', async () => {
    const fetcher: PwnedRangeFetcher = () =>
      Promise.resolve(rangeBody([`${SUFFIX.toLowerCase()}:3`]));
    const check = new PwnedPasswordsBreachCheck(fetcher, fakeLogger().logger);
    await expect(check.isBreached(PASSWORD)).resolves.toBe(true);
  });

  it('ignores padding rows (count 0)', async () => {
    const fetcher: PwnedRangeFetcher = () => Promise.resolve(rangeBody([`${SUFFIX}:0`]));
    const check = new PwnedPasswordsBreachCheck(fetcher, fakeLogger().logger);
    await expect(check.isBreached(PASSWORD)).resolves.toBe(false);
  });

  it('passes a password whose suffix is absent', async () => {
    const fetcher: PwnedRangeFetcher = () =>
      Promise.resolve(rangeBody(['0123456789ABCDEF0123456789ABCDEF012:7']));
    const check = new PwnedPasswordsBreachCheck(fetcher, fakeLogger().logger);
    await expect(check.isBreached(PASSWORD)).resolves.toBe(false);
  });

  it('fails open when the API errors, and logs a metric without the password', async () => {
    const { warn, logger } = fakeLogger();
    const fetcher: PwnedRangeFetcher = () =>
      Promise.reject(new Error(`range ${PREFIX} answered 503`));
    const check = new PwnedPasswordsBreachCheck(fetcher, logger);
    await expect(check.isBreached(PASSWORD)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatchObject({
      metric: 'breach_check_unavailable',
      reason: 'error',
    });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(PASSWORD);
    expect(logged).not.toContain(PREFIX);
  });

  it('fails open after the timeout, aborting the request', async () => {
    const { warn, logger } = fakeLogger();
    let aborted = false;
    const fetcher: PwnedRangeFetcher = (_prefix, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('aborted'));
        });
      });
    const check = new PwnedPasswordsBreachCheck(fetcher, logger, 20);
    await expect(check.isBreached(PASSWORD)).resolves.toBe(false);
    expect(aborted).toBe(true);
    expect(warn.mock.calls[0]?.[0]).toMatchObject({
      metric: 'breach_check_unavailable',
      reason: 'timeout',
    });
  });

  it('times out after 2 seconds by default', () => {
    expect(PwnedPasswordsBreachCheck.DEFAULT_TIMEOUT_MS).toBe(2000);
  });
});

describe('createBreachCheck', () => {
  const fetcher = vi.fn<PwnedRangeFetcher>();

  it('uses the offline list locally, so nothing leaves the machine', async () => {
    const check = createBreachCheck('local', fakeLogger().logger, fetcher);
    expect(check).toBeInstanceOf(OfflineBreachCheck);
    await check.isBreached(PASSWORD);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['staging', 'production'] as const)('uses the range API in %s', (appEnv) => {
    expect(createBreachCheck(appEnv, fakeLogger().logger, fetcher)).toBeInstanceOf(
      PwnedPasswordsBreachCheck,
    );
  });
});
