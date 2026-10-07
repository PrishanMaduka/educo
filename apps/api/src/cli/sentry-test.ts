import { loadBootConfig } from '../boot';
import { initErrorReporting } from '../observability/sentry';

import { redact } from './run-command';

import type { Config } from '../config';
import type { ErrorReporter } from '../observability/sentry';

const FLUSH_MS = 5_000;

export interface SentryTestResult {
  readonly code: 0 | 1;
  readonly message: string;
}

/**
 * Sends one test error to Sentry so a new environment can be checked end to end (D28). Never in
 * production, where it would page people for nothing.
 */
export async function runSentryTest(
  config: Config,
  makeReporter: (config: Config, service: 'api') => ErrorReporter = initErrorReporting,
): Promise<SentryTestResult> {
  if (config.APP_ENV === 'production') {
    return { code: 1, message: 'The Sentry test error is not sent in production.' };
  }
  if (config.SENTRY_DSN === undefined) {
    return { code: 1, message: 'SENTRY_DSN is not set.' };
  }
  const reporter = makeReporter(config, 'api');
  const eventId = reporter.capture(new Error(`Quad Sentry test error (api, ${config.APP_ENV})`));
  if (!(await reporter.flush(FLUSH_MS))) {
    return {
      code: 1,
      message: `The Sentry test error was not delivered within ${FLUSH_MS / 1000} s.`,
    };
  }
  return { code: 0, message: `Sent the Sentry test error ${eventId ?? '(no event id)'}.` };
}

/** `node dist/sentry-test.js`: prints the result and exits with its code. */
if (require.main === module) {
  runSentryTest(loadBootConfig()).then(
    ({ code, message }) => {
      (code === 0 ? process.stdout : process.stderr).write(`${message}\n`);
      process.exit(code);
    },
    (error: unknown) => {
      process.stderr.write(`sentry-test failed: ${redact(error)}\n`);
      process.exit(1);
    },
  );
}
