import { loadBootConfig } from './boot';
import { initErrorReporting } from './observability/sentry';
import { startTracing } from './observability/tracing';
import { createShutdown, onShutdownSignals } from './shutdown';
import { LOGGER } from './tokens';

import type { Logger } from 'pino';

/** API entry point: config check, error reporting, tracing, then the Nest app on API_PORT. */
async function main(): Promise<void> {
  const config = loadBootConfig();
  const reporter = initErrorReporting(config, 'api');
  const tracing = await startTracing(config, 'api');
  // Loaded after tracing starts so the HTTP, Fastify, pg and ioredis instrumentations apply.
  const { createApp } = await import('./app');
  const app = await createApp(config, { reporter });
  const logger = app.get<symbol, Logger>(LOGGER);

  onShutdownSignals(
    createShutdown('API', { logger, tracing, reporter, close: () => app.close() }),
  );

  // 0.0.0.0 so the API is reachable from containers, emulators and the LAN in local dev.
  await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
  logger.info(
    {
      port: config.API_PORT,
      appEnv: config.APP_ENV,
      tracing: tracing.enabled,
      errorReporting: config.SENTRY_DSN !== undefined,
    },
    'API listening',
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `The API failed to start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
