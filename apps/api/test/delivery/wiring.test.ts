import { createTenantDb } from '@quad/db';
import { Redis } from 'ioredis';
import pino from 'pino';
import { afterAll, describe, expect, it } from 'vitest';

import { BullDelivery } from '../../src/common/delivery/delivery.service';
import { EMAIL_QUEUE, SMS_QUEUE } from '../../src/common/delivery/queues';
import { RateLimitService } from '../../src/common/rate-limit/rate-limit.service';
import { loadConfig } from '../../src/config';
import { PASSWORD_RESET_REQUEST_QUEUE } from '../../src/modules/auth/password-reset-requests';
import { DELIVERY } from '../../src/tokens';
import { buildProcessors } from '../../src/worker/run';
import { CLOSED_PORTS, useTestApp } from '../app';
import { localEnv } from '../env';
import { RecordingDelivery } from '../fakes/delivery';

describe('the app wiring (no Redis needed: connections open on first use)', () => {
  const app = useTestApp(CLOSED_PORTS);

  it('provides the BullMQ delivery queue and the rate limiter', () => {
    expect(app().get(DELIVERY)).toBeInstanceOf(BullDelivery);
    expect(app().get(RateLimitService)).toBeInstanceOf(RateLimitService);
  });

  it('answers routes without a rate limit without touching Redis', async () => {
    const response = await app().inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(response.statusCode).toBe(200);
  });
});

describe('the delivery override for tests', () => {
  const recording = new RecordingDelivery();
  const app = useTestApp(CLOSED_PORTS, { overrides: { delivery: recording } });

  it('replaces the queue with the given fake', () => {
    expect(app().get(DELIVERY)).toBe(recording);
  });
});

describe('the worker processors', () => {
  const redis = new Redis(CLOSED_PORTS.REDIS_URL, { lazyConnect: true });
  afterAll(() => {
    redis.disconnect();
  });

  it('registers send-email, send-sms and password-reset-request', async () => {
    const config = loadConfig(localEnv({ SMTP_URL: 'smtp://localhost:1025', ...CLOSED_PORTS }));
    const db = createTenantDb({ appUrl: config.DATABASE_URL });
    try {
      const processors = await buildProcessors(config, pino({ level: 'silent' }), redis, db);
      expect(Object.keys(processors).sort()).toEqual(
        [EMAIL_QUEUE, SMS_QUEUE, PASSWORD_RESET_REQUEST_QUEUE].sort(),
      );
    } finally {
      await db.close();
    }
  });
});
