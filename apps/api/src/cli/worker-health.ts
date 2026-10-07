import { hostname } from 'node:os';

import { Redis } from 'ioredis';

import { heartbeatKey } from '../worker/heartbeat';

import { requireEnv, runCommand } from './run-command';

const TIMEOUT_MS = 3_000;

/**
 * `node dist/worker-health.js`: the worker container's health check. Exits 0 when this host's
 * heartbeat key exists in Redis, and 1 when it is missing or Redis does not answer within 3 s.
 */
async function workerHealth(): Promise<string> {
  const redis = new Redis(requireEnv(process.env, 'REDIS_URL'), {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    connectTimeout: TIMEOUT_MS,
  });
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Redis did not answer within ${TIMEOUT_MS / 1000} s.`));
    }, TIMEOUT_MS);
  });
  try {
    const found = await Promise.race([
      redis.connect().then(() => redis.exists(heartbeatKey(hostname()))),
      timeout,
    ]);
    if (found !== 1) {
      throw new Error('No worker heartbeat from this host in the last minute.');
    }
    return 'The worker is alive.';
  } finally {
    clearTimeout(timer);
    redis.disconnect();
  }
}

if (require.main === module) {
  runCommand('worker-health', workerHealth);
}
