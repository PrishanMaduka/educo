import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { heartbeatKey, startHeartbeat } from '../src/worker/heartbeat';

import type { HeartbeatStore } from '../src/worker/heartbeat';

function fakeRedis(): HeartbeatStore & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    set: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve('OK');
    },
  };
}

describe('worker heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T08:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('names the key after the host', () => {
    expect(heartbeatKey('host-a')).toBe('quad:worker:heartbeat:host-a');
  });

  it('sets the key with a 60 s expiry at start and every 15 s until stopped', async () => {
    const redis = fakeRedis();
    const stop = startHeartbeat(redis, heartbeatKey('host-a'));
    expect(redis.calls).toEqual([
      ['quad:worker:heartbeat:host-a', '2026-10-07T08:00:00.000Z', 'EX', 60],
    ]);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(redis.calls).toHaveLength(2);
    expect(redis.calls[1]).toEqual([
      'quad:worker:heartbeat:host-a',
      '2026-10-07T08:00:15.000Z',
      'EX',
      60,
    ]);

    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(redis.calls).toHaveLength(2);
  });

  it('takes a custom interval and expiry', async () => {
    const redis = fakeRedis();
    const stop = startHeartbeat(redis, 'k', { intervalMs: 1_000, ttlSeconds: 5 });
    await vi.advanceTimersByTimeAsync(3_000);
    stop();
    expect(redis.calls).toHaveLength(4);
    expect(redis.calls[3]?.slice(2)).toEqual(['EX', 5]);
  });

  it('reports a failed write without throwing', async () => {
    const onError = vi.fn();
    const failing: HeartbeatStore = {
      set: () => Promise.reject(new Error('down')),
    };
    const stop = startHeartbeat(failing, 'k', { onError });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'down' }));
  });
});
