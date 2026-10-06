import { errorForLog } from './observability/logger';

import type { Tracing } from './observability/tracing';
import type { Logger } from 'pino';

/** ECS sends SIGKILL 30 s after SIGTERM; leave time to exit on our own terms. */
const FORCE_EXIT_AFTER_MS = 25_000;

export interface ShutdownDeps {
  readonly logger: Logger;
  /** Stops accepting work and closes connections (the Nest app, BullMQ workers, Redis). */
  readonly close: () => Promise<void>;
  readonly tracing: Tracing;
  /** Defaults to `process.exit`; injectable for tests. */
  readonly exit?: (code: number) => void;
}

/**
 * Returns a signal handler that closes once: `close()`, then always flushes tracing, then exits
 * 0 (or 1 if closing failed). A timer forces exit 1 if closing hangs; it is unref'd so it never
 * keeps the process alive by itself.
 */
export function createShutdown(
  name: string,
  deps: ShutdownDeps,
): (signal: NodeJS.Signals) => Promise<void> {
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  let stopping = false;
  return async (signal) => {
    if (stopping) return;
    stopping = true;
    deps.logger.info({ signal }, `${name} stopping`);
    const force = setTimeout(() => {
      deps.logger.error(`${name} did not stop within ${FORCE_EXIT_AFTER_MS / 1000} s; exiting`);
      exit(1);
    }, FORCE_EXIT_AFTER_MS);
    force.unref();
    let code = 0;
    try {
      await deps.close();
    } catch (error) {
      code = 1;
      deps.logger.error({ error: errorForLog(error) }, `${name} failed to close cleanly`);
    } finally {
      await deps.tracing.shutdown().catch(() => undefined);
    }
    clearTimeout(force);
    exit(code);
  };
}

/** Wires a shutdown handler to SIGTERM and SIGINT. */
export function onShutdownSignals(stop: (signal: NodeJS.Signals) => Promise<void>): void {
  process.once('SIGTERM', (signal) => void stop(signal));
  process.once('SIGINT', (signal) => void stop(signal));
}
