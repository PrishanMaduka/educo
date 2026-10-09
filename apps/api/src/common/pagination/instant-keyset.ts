import { IdSchema } from '@quad/contracts';
import { sql } from '@quad/db';
import { z } from 'zod';

import type { AnyColumn, SQL } from '@quad/db';

/**
 * The keyset of a list ordered newest first by an instant, then id. Postgres keeps microseconds
 * and a JS `Date` only milliseconds, so the cursor carries the instant as text with all six
 * digits: rows a millisecond apart, or in the same millisecond, are never skipped or repeated.
 */
export const InstantKeyset = z.object({
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
  id: IdSchema,
});
export type InstantKeyset = z.infer<typeof InstantKeyset>;

/** `column` as UTC ISO 8601 text with microseconds, for the keyset of the last row. */
export function instantText(column: AnyColumn): SQL<string> {
  return sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

/** The rows after `after` in newest-first order (none to skip on the first page). */
export function olderThan(
  at: AnyColumn,
  id: AnyColumn,
  after: InstantKeyset | null,
): SQL | undefined {
  return after === null
    ? undefined
    : sql`(${at}, ${id}) < (${after.at}::timestamptz, ${after.id}::uuid)`;
}
