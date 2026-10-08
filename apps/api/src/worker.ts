import { loadBootConfig } from './boot';
import { initErrorReporting, reportFatalError } from './observability/sentry';
import { startTracing } from './observability/tracing';

import type { ErrorReporter } from './observability/sentry';

/** Set once error reporting has started, so a later startup failure is reported too. */
let reporter: ErrorReporter | undefined;

/** Worker entry point (BullMQ): config check, error reporting, tracing, then the queue workers. */
async function main(): Promise<void> {
  const config = loadBootConfig();
  const errors = initErrorReporting(config, 'worker');
  reporter = errors;
  const tracing = await startTracing(config, 'worker');
  // Loaded after tracing starts so the ioredis and pg instrumentations apply.
  const { runWorkers } = await import('./worker/run');
  await runWorkers(config, tracing, errors);
}

main().catch(async (error: unknown) => {
  await reportFatalError(reporter, error);
  process.stderr.write(
    `The worker failed to start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
