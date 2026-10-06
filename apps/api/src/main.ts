import { loadBootConfig } from './boot';
import { startTracing } from './observability/tracing';
import { LOGGER } from './tokens';

import type { Logger } from 'pino';

/** API entry point: config check, tracing, then the Nest app on API_PORT. */
async function main(): Promise<void> {
  const config = loadBootConfig();
  const tracing = await startTracing(config, 'api');
  // Loaded after tracing starts so the HTTP, Fastify, pg and ioredis instrumentations apply.
  const { createApp } = await import('./app');
  const app = await createApp(config);
  const logger = app.get<symbol, Logger>(LOGGER);

  let stopping = false;
  const stop = async (signal: NodeJS.Signals): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'API stopping');
    await app.close();
    await tracing.shutdown();
    process.exit(0);
  };
  process.once('SIGTERM', (signal) => void stop(signal));
  process.once('SIGINT', (signal) => void stop(signal));

  // 0.0.0.0 so the API is reachable from containers, emulators and the LAN in local dev.
  await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
  logger.info(
    { port: config.API_PORT, appEnv: config.APP_ENV, tracing: tracing.enabled },
    'API listening',
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `The API failed to start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
