import { createTransport } from '@sentry/node';
import Fastify from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';

import { initErrorReporting } from '../src/observability/sentry';

/**
 * The real Sentry SDK with an in-memory transport: proves what an error report from a request
 * actually contains, independent of the scrubber's own unit tests. Nothing leaves the process.
 */
const bodies: string[] = [];
const decoder = new TextDecoder();
const reporter = initErrorReporting(
  { APP_ENV: 'staging', SENTRY_DSN: 'https://public@o1.ingest.sentry.io/1' },
  'api',
  {
    transport: (options) =>
      createTransport(options, (request) => {
        bodies.push(typeof request.body === 'string' ? request.body : decoder.decode(request.body));
        return Promise.resolve({ statusCode: 200 });
      }),
  },
);

const app = Fastify();
app.post('/api/v1/boom', () => {
  throw new Error('No guardian for amaya@example.com');
});
app.setErrorHandler((error, _request, reply) => {
  reporter.capture(error);
  void reply.status(500).send({ code: 'internal' });
});

afterAll(async () => {
  await app.close();
});

/** The `event` items of the envelopes the transport received. */
function sentEvents(): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  for (const body of bodies) {
    const lines = body.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('"type":"event"')) {
        const payload: unknown = JSON.parse(lines[index + 1] ?? 'null');
        if (typeof payload === 'object' && payload !== null) events.push({ ...payload });
      }
    });
  }
  return events;
}

describe('Sentry error report from a request', () => {
  it('sends only the URL without query, the method and the user agent', async () => {
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const response = await fetch(`${address}/api/v1/boom?token=s3cret-token&next=%2F`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer s3cret-bearer',
        cookie: 'quad_session=s3cret-session',
        'content-type': 'application/json',
        'user-agent': 'QuadTest/1.0',
        'x-forwarded-for': '203.0.113.9',
      },
      body: JSON.stringify({ note: 'allergic to peanuts', phone: '+94 77 000 0001' }),
    });
    expect(response.status).toBe(500);
    await expect(reporter.flush(2_000)).resolves.toBe(true);

    const [event] = sentEvents();
    expect(event).toBeDefined();
    expect(event?.request).toEqual({
      url: `${address}/api/v1/boom`,
      method: 'POST',
      headers: { 'user-agent': 'QuadTest/1.0' },
    });
    expect(event).not.toHaveProperty('user');

    const sent = bodies.join('\n');
    for (const secret of [
      's3cret',
      'quad_session',
      'Bearer',
      '203.0.113.9',
      '127.0.0.1"',
      'peanuts',
      '000 0001',
      'amaya@example.com',
    ]) {
      expect(sent).not.toContain(secret);
    }
  });
});
