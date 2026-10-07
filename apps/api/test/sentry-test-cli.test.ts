import { createServer } from 'node:net';

import { createTransport } from '@sentry/node';
import { describe, expect, it } from 'vitest';

import { runSentryTest } from '../src/cli/sentry-test';
import { loadConfig } from '../src/config';

import { productionEnv } from './env';

import type { NodeOptions } from '@sentry/node';

type BaseTransport = NonNullable<NodeOptions['transport']>;

const decoder = new TextDecoder();

/** A transport that answers every envelope with `statusCode` and keeps the bodies. */
function answering(statusCode: number, bodies: string[] = []): BaseTransport {
  return (options) =>
    createTransport(options, (request) => {
      bodies.push(typeof request.body === 'string' ? request.body : decoder.decode(request.body));
      return Promise.resolve({ statusCode });
    });
}

const staging = (dsn: string) => loadConfig(productionEnv({ APP_ENV: 'staging', SENTRY_DSN: dsn }));

/** A local port with nothing listening on it. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  return port;
}

describe('runSentryTest delivery (real SDK)', () => {
  it('prints the event id when Sentry accepts the test error', async () => {
    const bodies: string[] = [];
    const result = await runSentryTest(
      staging('https://public@o1.ingest.sentry.io/1'),
      undefined,
      answering(200, bodies),
    );

    expect(result.code).toBe(0);
    expect(result.message).toMatch(/^Sent the Sentry test error [0-9a-f]{32}\.$/);
    expect(bodies.join('\n')).toContain('Quad Sentry test error (api, staging)');
  });

  it('fails when Sentry refuses the test error', async () => {
    const result = await runSentryTest(
      staging('https://public@o1.ingest.sentry.io/1'),
      undefined,
      answering(500),
    );

    expect(result).toEqual({
      code: 1,
      message: 'Sentry did not accept the Sentry test error (HTTP 500).',
    });
  });

  it('fails when the DSN points at a port where nothing listens', async () => {
    const port = await closedPort();
    const result = await runSentryTest(staging(`http://public@127.0.0.1:${port}/1`));

    expect(result.code).toBe(1);
    expect(result.message).toMatch(/^Sentry did not accept the Sentry test error \(.+\)\.$/);
  });
});
