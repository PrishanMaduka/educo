import type { Redis } from 'ioredis';

/** Remembers which jobs have been delivered, so a job that runs twice sends once. */
export interface OnceStore {
  isDone(key: string): Promise<boolean>;
  markDone(key: string): Promise<void>;
}

/** Longer than a job's retries (about 15 minutes) and BullMQ's stalled-job recovery. */
const DONE_TTL_SECONDS = 7 * 24 * 60 * 60;

/** `OnceStore` on Redis: `quad:delivery:done:<queue>:<job id>`, kept for a week. */
export function redisOnce(redis: Redis): OnceStore {
  const key = (name: string): string => `quad:delivery:done:${name}`;
  return {
    isDone: async (name) => (await redis.exists(key(name))) === 1,
    markDone: async (name) => {
      await redis.set(key(name), '1', 'EX', DONE_TTL_SECONDS);
    },
  };
}

/** The parts of a BullMQ job a delivery processor reads. */
export interface DeliveryJobLike {
  readonly id?: string | undefined;
  readonly data: unknown;
}
