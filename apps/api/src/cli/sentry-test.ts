import { makeNodeTransport } from '@sentry/node';

import { loadBootConfig } from '../boot';
import { initErrorReporting } from '../observability/sentry';

import { redact } from './run-command';

import type { Config } from '../config';
import type { ErrorReporter } from '../observability/sentry';
import type { NodeOptions } from '@sentry/node';

const FLUSH_MS = 5_000;

export interface SentryTestResult {
  readonly code: 0 | 1;
  readonly message: string;
}

type Transport = NonNullable<NodeOptions['transport']>;
type MakeReporter = (
  config: Config,
  service: 'api',
  overrides: Pick<NodeOptions, 'transport'>,
) => ErrorReporter;

/**
 * Wraps a transport to record what happened to each envelope. `flush()` only says the queue
 * drained: the SDK drops an envelope it could not send (connection refused, HTTP 4xx/5xx) and
 * still flushes true, so the outcome is read from the transport itself.
 */
function trackDelivery(base: Transport): {
  transport: Transport;
  failure: () => string | undefined;
} {
  const outcomes: string[] = [];
  let delivered = false;
  const transport: Transport = (options) => {
    const inner = base(options);
    return {
      ...inner,
      send: async (envelope) => {
        try {
          const response = await inner.send(envelope);
          const status = response.statusCode;
          if (status !== undefined && status >= 200 && status < 300) delivered = true;
          else outcomes.push(`HTTP ${status ?? 'unknown'}`);
          return response;
        } catch (error) {
          outcomes.push(error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
    };
  };
  return {
    transport,
    failure: () =>
      outcomes.length > 0 ? outcomes.join('; ') : delivered ? undefined : 'nothing was sent',
  };
}

/**
 * Sends one test error to Sentry so a new environment can be checked end to end (D28). Never in
 * production, where it would page people for nothing. Succeeds only when the queue flushed in
 * time and Sentry answered the envelope with a 2xx.
 */
export async function runSentryTest(
  config: Config,
  makeReporter: MakeReporter = initErrorReporting,
  baseTransport: Transport = makeNodeTransport,
): Promise<SentryTestResult> {
  if (config.APP_ENV === 'production') {
    return { code: 1, message: 'The Sentry test error is not sent in production.' };
  }
  if (config.SENTRY_DSN === undefined) {
    return { code: 1, message: 'SENTRY_DSN is not set.' };
  }
  const delivery = trackDelivery(baseTransport);
  const reporter = makeReporter(config, 'api', { transport: delivery.transport });
  const eventId = reporter.capture(new Error(`Quad Sentry test error (api, ${config.APP_ENV})`));
  if (!(await reporter.flush(FLUSH_MS))) {
    return {
      code: 1,
      message: `The Sentry test error was not delivered within ${FLUSH_MS / 1000} s.`,
    };
  }
  const failure = delivery.failure();
  if (failure !== undefined) {
    return { code: 1, message: `Sentry did not accept the Sentry test error (${failure}).` };
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
