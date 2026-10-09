import { randomBytes } from 'node:crypto';

import { Queue, QueueEvents, UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';

import {
  BullPasswordResetRequests,
  PASSWORD_RESET_REQUEST_QUEUE,
  passwordResetJobIds,
} from '../../src/modules/auth/password-reset-requests';
import { localEnv } from '../env';
import { freshEmail } from '../helpers/sign-in';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

describe('the password-reset-request queue (BullMQ, compose Redis)', () => {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  // A prefix of its own, so these jobs never reach a local worker and runs never collide.
  const prefix = `test-reset-${randomBytes(4).toString('hex')}`;
  const requests = new BullPasswordResetRequests(redis, () => undefined, prefix);
  const queue = new Queue(PASSWORD_RESET_REQUEST_QUEUE, { connection: redis, prefix });
  const events = new QueueEvents(PASSWORD_RESET_REQUEST_QUEUE, {
    connection: redis.duplicate(),
    prefix,
  });
  const jobIdOf = passwordResetJobIds(localEnv().SESSION_SECRET ?? '');

  afterAll(async () => {
    await requests.beforeApplicationShutdown();
    await events.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await redis.quit();
  });

  it('takes a new request for an address whose last job failed for good, and keeps no failed job', async () => {
    await events.waitUntilReady();
    const email = freshEmail();
    const jobId = jobIdOf(email);
    await requests.request({ jobId, email });

    const failed = new Promise<void>((resolve) => {
      events.on('failed', ({ jobId: failedId }) => {
        if (failedId === jobId) resolve();
      });
    });
    const worker = new Worker(
      PASSWORD_RESET_REQUEST_QUEUE,
      () => Promise.reject(new UnrecoverableError('The account lookup failed for good.')),
      { connection: redis.duplicate(), prefix },
    );
    try {
      await failed;
    } finally {
      await worker.close();
    }

    // The failed job (and the email in it) is gone, so the next Forgot is queued again.
    expect(await queue.getJob(jobId)).toBeUndefined();
    await requests.request({ jobId, email });
    const again = await queue.getJob(jobId);
    expect(again?.data).toEqual({ email });
    expect(await again?.getState()).toBe('waiting');
  });
});
