import { createHash } from 'node:crypto';

import { IfMatchHeaders } from '@quad/contracts';

import { StaleVersionError } from '../errors';
import { ZodValidationPipe } from '../zod.pipe';

import type { FastifyRequest } from 'fastify';

const ifMatchHeaders = new ZodValidationPipe(IfMatchHeaders);

/** The request's `If-Match`, or 400 `validation` on `if-match` when it has none (spec 06). */
export function ifMatchOf(request: FastifyRequest): string {
  return ifMatchHeaders.transform(request.headers)['if-match'];
}

/** JSON with object keys sorted at every level, so equal values always give the same text. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * A strong `ETag` for a record's editable state (spec 06 Concurrency): the first 128 bits of the
 * SHA-256 of its JSON, quoted. Any change to a value changes it; key order does not.
 */
export function etagOf(state: unknown): string {
  const digest = createHash('sha256').update(stableJson(state)).digest('base64url');
  return `"${digest.slice(0, 22)}"`;
}

/**
 * Refuses a change whose `If-Match` does not name `current` with 409 `conflict` and the current
 * version (spec 06). The comparison is strong (RFC 9110), so a weak tag never matches, and `*` is
 * refused too: a client must say which version it saw.
 */
export function assertIfMatch(ifMatch: string, current: string): void {
  const sent = ifMatch.split(',').map((tag) => tag.trim());
  if (!sent.includes(current)) throw new StaleVersionError(current);
}
