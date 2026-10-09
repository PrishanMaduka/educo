import { ValidationError } from '../errors';

import type { z } from 'zod';

/**
 * Cursor pagination (spec 06 Conventions: `?cursor=&limit=`, `{ items, nextCursor }`). A cursor
 * is the keyset of the last item, as base64url JSON: opaque to clients, parsed with a schema
 * when it comes back.
 */
export function encodeCursor(keyset: unknown): string {
  return Buffer.from(JSON.stringify(keyset)).toString('base64url');
}

/** The keyset in `cursor`, or null without one; a cursor that does not parse is a 400. */
export function decodeCursor<S extends z.ZodTypeAny>(
  schema: S,
  cursor: string | undefined,
): z.output<S> | null {
  if (cursor === undefined || cursor === '') {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new ValidationError({
      cursor: 'This page link is not valid. Start from the first page.',
    });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError({
      cursor: 'This page link is not valid. Start from the first page.',
    });
  }
  return parsed.data as z.output<S>;
}

/** The page of `limit` items and the next cursor, from a query that fetched `limit + 1` rows. */
export function pageOf<T>(
  rows: readonly T[],
  limit: number,
  keysetOf: (last: T) => unknown,
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(keysetOf(last)) : null,
  };
}
