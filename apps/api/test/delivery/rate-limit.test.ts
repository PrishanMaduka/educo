import { Writable } from 'node:stream';

import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RateLimit, rateLimitRulesOf } from '../../src/common/rate-limit/rate-limit.decorator';
import { RateLimitService } from '../../src/common/rate-limit/rate-limit.service';
import { CLOSED_PORTS } from '../app';

import { createProbeApp, emailOf, randomIp } from './rate-limit-probe';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Redis } from 'ioredis';

const SECRET = 'test-session-secret-test-session-secret';

describe('RateLimitService.hashSubject', () => {
  // `hit` is never called here, so the service needs no connection.
  const unused = {} as Redis;

  it('turns an email into a keyed hash with no trace of the address', () => {
    const hash = new RateLimitService(unused, SECRET).hashSubject(
      'prishan.maduka@colombo-intl.local',
    );
    expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).not.toContain('@');
    expect(hash).not.toContain('prishan');
  });

  it('is stable for one secret and differs under another', () => {
    const a = new RateLimitService(unused, SECRET);
    const b = new RateLimitService(unused, `${SECRET}-other`);
    expect(a.hashSubject('+94770000001')).toBe(a.hashSubject('+94770000001'));
    expect(a.hashSubject('+94770000001')).not.toBe(b.hashSubject('+94770000001'));
  });
});

describe('@RateLimit', () => {
  /** Applies decorators to a handler as TypeScript does for stacked ones: bottom first. */
  function decorate(handler: () => void, ...decorators: MethodDecorator[]): void {
    for (const decorator of [...decorators].reverse()) {
      decorator({}, 'handler', { value: handler });
    }
  }

  it('keeps stacked rules in source order (top first)', () => {
    const stacked = (): void => undefined;
    decorate(
      stacked,
      RateLimit({ limit: 2, windowSeconds: 60 }),
      RateLimit({ limit: 5, windowSeconds: 900, key: emailOf }),
    );
    expect(rateLimitRulesOf(stacked)).toEqual([
      { limit: 2, windowSeconds: 60 },
      { limit: 5, windowSeconds: 900, key: emailOf },
    ]);
  });

  it('has no rules on an undecorated handler', () => {
    expect(rateLimitRulesOf((): void => undefined)).toEqual([]);
  });

  it.each([
    { limit: 0, windowSeconds: 60 },
    { limit: 1.5, windowSeconds: 60 },
    { limit: 5, windowSeconds: 0 },
  ])('refuses a rule that could never work: %j', (rule) => {
    expect(() => RateLimit(rule)).toThrow();
  });
});

describe('the interceptor when Redis is down', () => {
  const lines: Record<string, unknown>[] = [];
  const logger = pino(
    { level: 'info' },
    new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
        callback();
      },
    }),
  );
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createProbeApp(CLOSED_PORTS.REDIS_URL, () => Date.now(), logger);
  });
  afterAll(async () => {
    await app.close();
  });

  it('lets the request through and logs the rate_limit_unavailable metric (fails open)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/probe',
      remoteAddress: randomIp(),
      payload: { email: 'prishan.maduka@colombo-intl.local' },
    });
    expect(response.statusCode).toBe(201);
    const warning = lines.find((line) => line.metric === 'rate_limit_unavailable');
    expect(warning).toBeDefined();
    expect(JSON.stringify(lines)).not.toContain('colombo-intl.local');
  });
});
