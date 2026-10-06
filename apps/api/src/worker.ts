import { loadBootConfig } from './boot';
import { startTracing } from './observability/tracing';

/** Worker entry point (BullMQ): config check, tracing, then the queue workers. */
async function main(): Promise<void> {
  const config = loadBootConfig();
  const tracing = await startTracing(config, 'worker');
  // Loaded after tracing starts so the ioredis and pg instrumentations apply.
  const { runWorkers } = await import('./worker/run');
  await runWorkers(config, tracing);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `The worker failed to start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
