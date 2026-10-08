import { randomBytes } from 'node:crypto';

import { Redis } from 'ioredis';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { heartbeatKey, startWorkerHeartbeat } from '../src/worker/heartbeat';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

describe('the worker heartbeat against the compose Redis', () => {
  const probe = new Redis(REDIS_URL);
  const host = `heartbeat-test-${randomBytes(4).toString('hex')}`;
  afterAll(async () => {
    await probe.del(heartbeatKey(host));
    await probe.quit();
  });

  it('writes the key with a 60 s expiry as soon as it starts, and deletes it when stopped', async () => {
    const onError = vi.fn();
    const stop = await startWorkerHeartbeat(REDIS_URL, host, onError);
    try {
      await vi.waitFor(
        async () => {
          expect(await probe.exists(heartbeatKey(host))).toBe(1);
        },
        { timeout: 1_000 },
      );
      const ttl = await probe.ttl(heartbeatKey(host));
      expect(ttl).toBeGreaterThan(55);
      expect(ttl).toBeLessThanOrEqual(60);
    } finally {
      await stop();
    }
    expect(await probe.exists(heartbeatKey(host))).toBe(0);
    expect(onError).not.toHaveBeenCalled();
  });
});
