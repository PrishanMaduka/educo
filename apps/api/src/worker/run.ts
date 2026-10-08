import { hostname } from 'node:os';

import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { createEmailTransport, emailSettingsOf } from '../common/delivery/email';
import { EMAIL_QUEUE, SMS_QUEUE } from '../common/delivery/queues';
import { createSmsSender } from '../common/delivery/sms';
import { createLogger, errorForLog } from '../observability/logger';
import { createShutdown, onShutdownSignals } from '../shutdown';

import { startWorkerHeartbeat } from './heartbeat';
import { isFinalAttempt } from './job-failure';
import { redisOnce } from './jobs/once';
import { createSendEmailProcessor } from './jobs/send-email.processor';
import { createSendSmsProcessor } from './jobs/send-sms.processor';

import type { Config } from '../config';
import type { ErrorReporter } from '../observability/sentry';
import type { Tracing } from '../observability/tracing';
import type { Processor } from 'bullmq';
import type { Logger } from 'pino';

/**
 * Queue name → processor. Each milestone adds its jobs here (area processors live in
 * `src/modules/<area>/jobs/`, shared ones in `src/worker/jobs/`, cross-tenant ones in
 * `src/worker/platform-jobs/`). `redis` is the worker's connection, also used for the
 * delivered-once markers.
 */
export async function buildProcessors(
  config: Config,
  logger: Logger,
  redis: Redis,
): Promise<Readonly<Record<string, Processor>>> {
  const once = redisOnce(redis);
  return {
    [EMAIL_QUEUE]: createSendEmailProcessor({
      transport: await createEmailTransport(config),
      once,
      settings: emailSettingsOf(config),
    }),
    [SMS_QUEUE]: createSendSmsProcessor({ sender: createSmsSender(config, logger), once }),
  };
}

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

/**
 * Connects to Redis, starts one BullMQ worker per queue and stops cleanly on SIGTERM/SIGINT. A job
 * that throws is logged by queue and job name, never with its data, and reported (Sentry) once it
 * has used its last attempt.
 */
export async function runWorkers(
  config: Config,
  tracing: Tracing,
  reporter: ErrorReporter,
): Promise<void> {
  const logger = createLogger(config, 'worker');
  // BullMQ needs `maxRetriesPerRequest: null` so blocking commands wait through reconnects.
  const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (error) => {
    logger.error({ error: errorForLog(error) }, 'Redis connection error');
  });
  await waitForRedis(connection);

  const processors = await buildProcessors(config, logger, connection);
  const workers = Object.entries(processors).map(([queue, processor]) => {
    const worker = new Worker(queue, processor, { connection });
    worker.on('failed', (job, error) => {
      const final = isFinalAttempt(job, error);
      logger.error({ error: errorForLog(error), queue, job: job?.name, final }, 'Job failed');
      // Retries are expected; only a job that has given up is reported.
      if (final) reporter.capture(error);
    });
    return worker;
  });
  // `dist/worker-health.js` (the container health check) looks for this key.
  const stopHeartbeat = await startWorkerHeartbeat(config.REDIS_URL, hostname(), (error) => {
    logger.warn({ error: errorForLog(error) }, 'Worker heartbeat write failed');
  });
  logger.info({ queues: Object.keys(processors) }, 'Worker ready');

  onShutdownSignals(
    createShutdown('Worker', {
      logger,
      tracing,
      reporter,
      close: async () => {
        await Promise.all(workers.map((worker) => worker.close()));
        await stopHeartbeat();
        await connection.quit();
      },
    }),
  );
}
