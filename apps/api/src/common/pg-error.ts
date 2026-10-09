/**
 * The SQLSTATE of a Postgres error, or undefined: Drizzle wraps the driver's error as its
 * `cause`. Services use it only to turn a known race into its answer (23505 a duplicate, 23503 a
 * row deleted meanwhile); anything else is rethrown.
 */
export function postgresCodeOf(error: unknown): string | undefined {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) return undefined;
  return typeof cause.code === 'string' ? cause.code : undefined;
}

export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';
