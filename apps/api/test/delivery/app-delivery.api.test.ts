import { randomBytes } from 'node:crypto';

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app';
import { SMS_QUEUE } from '../../src/common/delivery/queues';
import { runWithRequestContext } from '../../src/common/request-context';
import { loadConfig } from '../../src/config';
import { DELIVERY, REDIS } from '../../src/tokens';
import { localEnv } from '../env';

import type { DeliveryQueue } from '../../src/common/delivery/delivery.service';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

describe('delivery inside the real app', () => {
  const probe = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const texts = new Queue(SMS_QUEUE, { connection: probe });
  const jobId = `otp.app-test-${randomBytes(6).toString('hex')}`;

  afterAll(async () => {
    await texts.remove(jobId);
    await texts.close();
    await probe.quit();
  });

  it('queues on the shared connection, and closing the app closes the queue and Redis', async () => {
    // Its own app, since this test closes it.
    const app = await createApp(loadConfig(localEnv({ REDIS_URL })), {
      logger: pino({ level: 'silent' }),
    });
    const delivery = app.get<DeliveryQueue>(DELIVERY);
    await runWithRequestContext('app-delivery-test', () =>
      delivery.queueSms({
        jobId,
        to: '+94770000001',
        template: 'otp',
        params: { code: '482913', minutes: 10 },
      }),
    );
    expect(await texts.getJob(jobId)).toBeDefined();

    const redis = app.get<Redis>(REDIS);
    expect(redis.status).toBe('ready');
    const queueClose = vi.spyOn(Queue.prototype, 'close');
    const redisQuit = vi.spyOn(redis, 'quit');
    await app.close();
    await vi.waitFor(() => {
      expect(redis.status).toBe('end');
    });
    // The queue closes first (beforeApplicationShutdown), then the connection it shares.
    expect(queueClose).toHaveBeenCalledTimes(1);
    expect(redisQuit).toHaveBeenCalledTimes(1);
    expect(queueClose.mock.invocationCallOrder[0]).toBeLessThan(
      redisQuit.mock.invocationCallOrder[0] ?? 0,
    );
    queueClose.mockRestore();
  });
});
