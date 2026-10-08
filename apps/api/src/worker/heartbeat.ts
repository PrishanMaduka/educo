import { Redis } from 'ioredis';

/** The subset of ioredis the heartbeat uses, so tests can pass a fake. */
export interface HeartbeatStore {
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export interface HeartbeatOptions {
  readonly intervalMs?: number;
  readonly ttlSeconds?: number;
  /** Called when a write or the final delete fails; the next tick tries again. */
  readonly onError?: (error: unknown) => void;
}

const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_TTL_SECONDS = 60;

/** The Redis key a worker container refreshes; `worker-health.js` checks it (D28). */
export function heartbeatKey(host: string): string {
  return `quad:worker:heartbeat:${host}`;
}

/**
 * A Redis connection for the heartbeat alone (lazy: call `connect()` before the first write).
 * Without the offline queue a write fails at once
 * while Redis is down (and `onError` reports it) instead of waiting in BullMQ's connection,
 * which retries blocking commands forever.
 */
export function createHeartbeatConnection(redisUrl: string): Redis {
  const redis = new Redis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  // Connection errors surface through the failed writes; this keeps them from being unhandled.
  redis.on('error', () => undefined);
  return redis;
}

/**
 * Writes the current time to `key` now and every `intervalMs`, expiring after `ttlSeconds`, so
 * the key disappears when the worker stops ticking. `stop` ends the ticks, waits for the last
 * write and deletes the key, so a stopped worker is unhealthy at once.
 */
export function startHeartbeat(
  redis: HeartbeatStore,
  key: string,
  options: HeartbeatOptions = {},
): () => Promise<void> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const report = (error: unknown): void => {
    options.onError?.(error);
  };
  let last: Promise<unknown> = Promise.resolve();
  const beat = (): void => {
    last = redis.set(key, new Date().toISOString(), 'EX', ttlSeconds).catch(report);
  };
  beat();
  const timer = setInterval(beat, intervalMs);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await last;
    await redis.del(key).catch(report);
  };
}

/**
 * The worker's heartbeat: its own connection, connected before the first write (without the
 * offline queue, a write sent while connecting fails), keyed by `host`. `stop` deletes the key
 * and closes the connection.
 */
export async function startWorkerHeartbeat(
  redisUrl: string,
  host: string,
  onError: (error: unknown) => void,
): Promise<() => Promise<void>> {
  const redis = createHeartbeatConnection(redisUrl);
  await redis.connect();
  const stop = startHeartbeat(redis, heartbeatKey(host), { onError });
  return async () => {
    await stop();
    await redis.quit();
  };
}
