import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { createLogger, errorForLog } from '../observability/logger';
import { createShutdown, onShutdownSignals } from '../shutdown';

import type { Config } from '../config';
import type { Tracing } from '../observability/tracing';
import type { Processor } from 'bullmq';

/**
 * Queue name → processor. Empty in M0; each milestone adds its jobs here (processors live in
 * `src/modules/<area>/jobs/`, cross-tenant ones in `src/worker/platform-jobs/`).
 */
export const PROCESSORS: Readonly<Record<string, Processor>> = {};

/** How long the worker waits for Redis at start before giving up (the orchestrator restarts it). */
const STARTUP_TIMEOUT_MS = 10_000;

async function waitForRedis(connection: Redis): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Redis did not answer within ${STARTUP_TIMEOUT_MS / 1000} s.`));
    }, STARTUP_TIMEOUT_MS);
  });
  try {
    await Promise.race([connection.ping(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Connects to Redis, starts one BullMQ worker per queue and stops cleanly on SIGTERM/SIGINT. */
export async function runWorkers(config: Config, tracing: Tracing): Promise<void> {
  const logger = createLogger(config, 'worker');
  // BullMQ needs `maxRetriesPerRequest: null` so blocking commands wait through reconnects.
  const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (error) => {
    logger.error({ error: errorForLog(error) }, 'Redis connection error');
  });
  await waitForRedis(connection);

  const workers = Object.entries(PROCESSORS).map(
    ([queue, processor]) => new Worker(queue, processor, { connection }),
  );
  logger.info({ queues: Object.keys(PROCESSORS) }, 'Worker ready');

  onShutdownSignals(
    createShutdown('Worker', {
      logger,
      tracing,
      close: async () => {
        await Promise.all(workers.map((worker) => worker.close()));
        await connection.quit();
      },
    }),
  );
}
