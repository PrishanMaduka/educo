import { pingDatabase } from '@quad/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../src/config';
import { ReadinessService } from '../src/health/readiness.service';
import { pingRedis } from '../src/health/redis-ping';

import { localEnv } from './env';

vi.mock('@quad/db', () => ({ pingDatabase: vi.fn() }));
vi.mock('../src/health/redis-ping', () => ({ pingRedis: vi.fn() }));

const ping = vi.mocked(pingDatabase);
const redis = vi.mocked(pingRedis);

describe('ReadinessService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ping.mockReset().mockResolvedValue(true);
    redis.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces concurrent checks into one round of pings', async () => {
    const service = new ReadinessService(loadConfig(localEnv()));
    const results = await Promise.all(Array.from({ length: 20 }, () => service.check()));
    expect(ping).toHaveBeenCalledTimes(1);
    expect(redis).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((r) => JSON.stringify(r)))).toEqual(
      new Set([JSON.stringify({ status: 'ok', db: 'ok', redis: 'ok' })]),
    );
  });

  it('reuses a result for 2 s, then checks again', async () => {
    const service = new ReadinessService(loadConfig(localEnv()));
    await service.check();
    vi.advanceTimersByTime(1999);
    await service.check();
    expect(ping).toHaveBeenCalledTimes(1);

    ping.mockResolvedValue(false);
    vi.advanceTimersByTime(2);
    expect(await service.check()).toEqual({ status: 'down', db: 'down', redis: 'ok' });
    expect(ping).toHaveBeenCalledTimes(2);
  });
});
