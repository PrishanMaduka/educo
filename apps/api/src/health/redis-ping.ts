import { Redis } from 'ioredis';

/**
 * Opens a short-lived connection, sends PING and closes it. Returns false on any failure or
 * after `timeoutMs`, never throws (like `pingDatabase` in @quad/db).
 */
export async function pingRedis(url: string, timeoutMs = 1000): Promise<boolean> {
  let redis: Redis;
  try {
    redis = new Redis(url, {
      lazyConnect: true,
      connectTimeout: timeoutMs,
      commandTimeout: timeoutMs,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
  } catch {
    return false;
  }
  redis.on('error', () => undefined);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
  });
  const ping = (async () => {
    await redis.connect();
    await redis.ping();
    return true;
  })().catch(() => false);
  try {
    return await Promise.race([ping, timeout]);
  } finally {
    clearTimeout(timer);
    redis.disconnect();
  }
}
