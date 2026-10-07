/** The subset of ioredis the heartbeat uses, so tests can pass a fake. */
export interface HeartbeatStore {
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
}

export interface HeartbeatOptions {
  readonly intervalMs?: number;
  readonly ttlSeconds?: number;
  /** Called when a write fails; the next tick tries again. */
  readonly onError?: (error: unknown) => void;
}

const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_TTL_SECONDS = 60;

/** The Redis key a worker container refreshes; `worker-health.js` checks it (D28). */
export function heartbeatKey(host: string): string {
  return `quad:worker:heartbeat:${host}`;
}

/**
 * Writes the current time to `key` now and every `intervalMs`, expiring after `ttlSeconds`, so
 * the key disappears when the worker stops ticking. Returns `stop`.
 */
export function startHeartbeat(
  redis: HeartbeatStore,
  key: string,
  options: HeartbeatOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const beat = (): void => {
    redis.set(key, new Date().toISOString(), 'EX', ttlSeconds).catch((error: unknown) => {
      options.onError?.(error);
    });
  };
  beat();
  const timer = setInterval(beat, intervalMs);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
