import { z } from 'zod';

import { errorForLog } from '../../observability/logger';

import type { Logger } from 'pino';

/**
 * The Redis cache shared by cookie sessions (`SessionService`) and parent refresh families
 * (`BearerSessions`), D32: entries live 30 s, and two index sets per entry (per account and
 * school, and per account) let a revocation drop every entry of a member or an account.
 */

/** Spec 05 / D32: a resolved session is cached in Redis for 30 s. */
export const SESSION_CACHE_SECONDS = 30;
/** The index sets outlive the entries they list, so an entry is never left unindexed. */
export const INDEX_SECONDS = 2 * SESSION_CACHE_SECONDS;

const KEY_PREFIX = 'quad:session';

/** A cookie session's entry, by the cookie's SHA-256; the index sets hold its hex. */
export const entryKey = (tokenHash: Buffer) => `${KEY_PREFIX}:${tokenHash.toString('hex')}`;
/** A parent refresh family, by its id; the index sets hold `f:<id>` for it. */
export const familyMember = (sessionId: string) => `f:${sessionId}`;
export const familyKey = (sessionId: string) => `${KEY_PREFIX}:${familyMember(sessionId)}`;
/** The entry key of an index set's member (a cookie hash in hex, or `f:<id>`). */
export const indexedKey = (member: string) => `${KEY_PREFIX}:${member}`;
export const memberIndexKey = (accountId: string, tenantId: string | null) =>
  `${KEY_PREFIX}:idx:m:${accountId}:${tenantId ?? '-'}`;
export const accountIndexKey = (accountId: string) => `${KEY_PREFIX}:idx:a:${accountId}`;

/** An instant as cached (ISO 8601), read back as a Date. */
export const Instant = z
  .string()
  .datetime()
  .transform((value) => new Date(value));

/**
 * Runs a cache command; if Redis fails, logs `session_cache_unavailable` and carries on with
 * Postgres. A failed invalidation leaves an entry for at most `SESSION_CACHE_SECONDS`.
 */
export async function cacheSafely<T>(
  logger: Logger,
  operation: string,
  command: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await command();
  } catch (error) {
    logger.warn(
      { metric: 'session_cache_unavailable', operation, error: errorForLog(error) },
      'Session cache skipped: Redis did not answer',
    );
    return undefined;
  }
}
