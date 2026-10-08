import { loadBootConfig } from './boot';
import { initErrorReporting, reportFatalError } from './observability/sentry';
import { startTracing } from './observability/tracing';
import { createShutdown, onShutdownSignals } from './shutdown';
import { LOGGER } from './tokens';

import type { ErrorReporter } from './observability/sentry';
import type { Logger } from 'pino';

/** Set once error reporting has started, so a later startup failure is reported too. */
let reporter: ErrorReporter | undefined;

/** API entry point: config check, error reporting, tracing, then the Nest app on API_PORT. */
async function main(): Promise<void> {
  const config = loadBootConfig();
  const errors = initErrorReporting(config, 'api');
  reporter = errors;
  const tracing = await startTracing(config, 'api');
  // Loaded after tracing starts so the HTTP, Fastify, pg and ioredis instrumentations apply.
  const { createApp } = await import('./app');
  const app = await createApp(config, { reporter: errors });
  const logger = app.get<symbol, Logger>(LOGGER);

  onShutdownSignals(
    createShutdown('API', { logger, tracing, reporter: errors, close: () => app.close() }),
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

main().catch(async (error: unknown) => {
  await reportFatalError(reporter, error);
  process.stderr.write(
    `The API failed to start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
