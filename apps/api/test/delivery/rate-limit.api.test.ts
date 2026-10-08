import { randomBytes, randomUUID } from 'node:crypto';

import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RateLimitService } from '../../src/common/rate-limit/rate-limit.service';
import { loadConfig } from '../../src/config';
import { localEnv } from '../env';

import { createProbeApp, randomIp } from './rate-limit-probe';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const MINUTE_MS = 60_000;
/** A fixed instant 5 s into a minute, so every call below shares one fixed window. */
const T0 = Date.UTC(2026, 9, 8, 9, 30, 5);
const config = loadConfig(localEnv({ REDIS_URL }));

let clockMs = T0;

describe('RateLimitService against the compose Redis', () => {
  const redis = new Redis(REDIS_URL);
  const service = new RateLimitService(redis, config.SESSION_SECRET);
  afterAll(async () => {
    await redis.quit();
  });

  it('allows 20 calls in a minute and refuses the 21st with the seconds left in the window', async () => {
    const key = `test:${randomUUID()}`;
    for (let call = 1; call <= 20; call += 1) {
      expect(await service.hit(key, 20, 60, T0 + call * 100)).toEqual({
        allowed: true,
        retryAfter: 0,
      });
    }
    expect(await service.hit(key, 20, 60, T0 + 2_100)).toEqual({ allowed: false, retryAfter: 53 });
  });

  it('resets on the fixed clock: a new minute starts a new window', async () => {
    const key = `test:${randomUUID()}`;
    for (let call = 1; call <= 20; call += 1) await service.hit(key, 20, 60, T0);
    expect((await service.hit(key, 20, 60, T0 + 54_999)).allowed).toBe(false);
    const nextMinute = T0 - (T0 % MINUTE_MS) + MINUTE_MS;
    expect(await service.hit(key, 20, 60, nextMinute)).toEqual({ allowed: true, retryAfter: 0 });
  });

  it('expires the window key in Redis once the window is over', async () => {
    const key = `test:${randomUUID()}`;
    await service.hit(key, 20, 60, T0);
    const keys = await redis.keys(`quad:rl:${key}:*`);
    expect(keys).toHaveLength(1);
    const ttl = await redis.pttl(keys[0] ?? '');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
  });
});

describe('the global rate-limit interceptor', () => {
  let app: NestFastifyApplication;
  const redis = new Redis(REDIS_URL);
  // The same secret as the probe app, to find the hashed key.
  const service = new RateLimitService(redis, config.SESSION_SECRET);

  beforeAll(async () => {
    app = await createProbeApp(REDIS_URL, () => clockMs);
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
  });

  const post = (url: string, ip: string, body: object = {}, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url, remoteAddress: ip, payload: body, headers });

  it.each(['/api/v1/auth/probe', '/api/v1/platform/auth/probe'])(
    'refuses the 21st call in a minute from one IP on %s with 429 rate_limited and Retry-After',
    async (url) => {
      clockMs = T0;
      const ip = randomIp();
      for (let call = 1; call <= 20; call += 1) {
        expect((await post(url, ip)).statusCode).toBe(201);
      }
      const refused = await post(url, ip);
      expect(refused.statusCode).toBe(429);
      expect(refused.json()).toMatchObject({ code: 'rate_limited' });
      expect(refused.headers['retry-after']).toBe('55');
      // Another address still gets in, and the next minute starts afresh.
      expect((await post(url, randomIp())).statusCode).toBe(201);
      clockMs = T0 + 55_000;
      expect((await post(url, ip)).statusCode).toBe(201);
    },
  );

  it('shares one per-IP bucket across every sign-in route (spec 06)', async () => {
    clockMs = T0;
    const ip = randomIp();
    for (let call = 1; call <= 20; call += 1) {
      const url = call % 2 === 0 ? '/api/v1/auth/probe' : '/api/v1/platform/auth/probe';
      expect((await post(url, ip)).statusCode).toBe(201);
    }
    for (const url of ['/api/v1/auth/probe', '/api/v1/platform/auth/probe']) {
      const refused = await post(url, ip);
      expect(refused.statusCode).toBe(429);
      expect(refused.json()).toMatchObject({ code: 'rate_limited' });
    }
  });

  it('does not limit other routes per IP', async () => {
    clockMs = T0;
    const ip = randomIp();
    for (let call = 1; call <= 25; call += 1) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/school/probe',
        remoteAddress: ip,
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it('refuses the 601st call in a minute from one signed-in user on any route', async () => {
    clockMs = T0;
    const user = randomUUID();
    const get = () =>
      app.inject({
        method: 'GET',
        url: '/api/v1/school/probe',
        remoteAddress: randomIp(),
        headers: { 'x-test-user': user },
      });
    for (let call = 1; call <= 600; call += 1) {
      expect((await get()).statusCode).toBe(200);
    }
    const refused = await get();
    expect(refused.statusCode).toBe(429);
    expect(refused.json()).toMatchObject({ code: 'rate_limited' });
  });

  it('limits per subject through a key function, keyed by an HMAC that holds no raw email', async () => {
    clockMs = T0;
    const email = `limit-${randomBytes(4).toString('hex')}@colombo-intl.local`;
    for (let call = 1; call <= 3; call += 1) {
      // A different address each time: the limit follows the email, not the IP.
      expect((await post('/api/v1/probe/email', randomIp(), { email })).statusCode).toBe(201);
    }
    const refused = await post('/api/v1/probe/email', randomIp(), { email: email.toUpperCase() });
    expect(refused.statusCode).toBe(429);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    // Another email is a separate subject.
    const other = `other-${randomBytes(4).toString('hex')}@colombo-intl.local`;
    expect((await post('/api/v1/probe/email', randomIp(), { email: other })).statusCode).toBe(201);

    // The counter is under the keyed hash of the address; no key holds the address itself.
    const hashed = await redis.keys(`quad:rl:*probe/email*:h:${service.hashSubject(email)}:*`);
    expect(hashed).toHaveLength(1);
    const keys = await redis.keys('quad:rl:*probe/email*');
    for (const key of keys) {
      expect(key).not.toContain(email.split('@')[0]);
      expect(key).not.toContain(other.split('@')[0]);
    }
    expect(hashed[0]).not.toContain('@');
  });

  it('skips a key-function limit when the request has no subject (validation answers later)', async () => {
    clockMs = T0;
    const ip = randomIp();
    for (let call = 1; call <= 2; call += 1) {
      expect((await post('/api/v1/probe/email', ip, {})).statusCode).toBe(201);
    }
  });

  it('applies every stacked @RateLimit: an IP limit and a per-email limit on one route', async () => {
    clockMs = T0;
    const ip = randomIp();
    const email = `stacked-${randomBytes(4).toString('hex')}@colombo-intl.local`;
    expect((await post('/api/v1/probe/stacked', ip, { email })).statusCode).toBe(201);
    expect((await post('/api/v1/probe/stacked', ip, { email })).statusCode).toBe(201);
    // Third call from the same IP: the per-IP limit of 2 refuses it.
    expect((await post('/api/v1/probe/stacked', ip, { email })).statusCode).toBe(429);
    // From other IPs, the per-email limit of 5 counts every call that passed the IP check.
    for (let call = 1; call <= 3; call += 1) {
      expect((await post('/api/v1/probe/stacked', randomIp(), { email })).statusCode).toBe(201);
    }
    expect((await post('/api/v1/probe/stacked', randomIp(), { email })).statusCode).toBe(429);
  });
});
