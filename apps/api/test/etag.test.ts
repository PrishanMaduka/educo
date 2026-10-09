import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { sendError, toErrorResponse } from '../src/common/error.filter';
import { StaleVersionError } from '../src/common/errors';
import { assertIfMatch, etagOf } from '../src/common/etag/etag';

import type { FastifyReply } from 'fastify';

describe('etagOf (spec 06 Concurrency)', () => {
  it('is a quoted strong tag that changes with any value and not with key order', () => {
    const tag = etagOf({ name: 'A', phone: null });
    expect(tag).toMatch(/^"[A-Za-z0-9_-]{22}"$/);
    expect(etagOf({ phone: null, name: 'A' })).toBe(tag);
    expect(etagOf({ name: 'B', phone: null })).not.toBe(tag);
    expect(etagOf({ name: 'A', phone: '' })).not.toBe(tag);
    expect(etagOf({ name: 'A', phone: null, nested: { b: [1, 2], a: true } })).toBe(
      etagOf({ nested: { a: true, b: [1, 2] }, phone: null, name: 'A' }),
    );
  });
});

describe('assertIfMatch', () => {
  const current = etagOf({ name: 'A' });

  it('passes the current tag, alone or in a list', () => {
    expect(() => {
      assertIfMatch(current, current);
    }).not.toThrow();
    expect(() => {
      assertIfMatch(`"old", ${current}`, current);
    }).not.toThrow();
  });

  it.each([
    ['a stale tag', etagOf({ name: 'B' })],
    ['a weak tag (If-Match compares strongly)', `W/${current}`],
    ['a wildcard', '*'],
  ])('refuses %s with 409 conflict carrying the current tag', (_name, header) => {
    let caught: unknown;
    try {
      assertIfMatch(header, current);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StaleVersionError);
    expect((caught as StaleVersionError).etag).toBe(current);
    expect(toErrorResponse(caught)).toMatchObject({ status: 409, body: { code: 'conflict' } });
  });
});

describe('sendError for a stale version', () => {
  it('sends the current version as the ETag header with the 409', () => {
    const headers: Record<string, string> = {};
    const reply = {
      header(name: string, value: string) {
        headers[name] = value;
        return reply;
      },
      status() {
        return reply;
      },
      send() {
        return reply;
      },
    };
    sendError(
      new StaleVersionError('"now"'),
      reply as unknown as FastifyReply,
      pino({ enabled: false }),
    );
    expect(headers).toEqual({ etag: '"now"' });
  });
});
