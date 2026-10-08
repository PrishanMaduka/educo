import { describe, expect, it } from 'vitest';

import { CLOSED_PORTS, useTestApp } from './app';

const app = useTestApp(CLOSED_PORTS);

function inject(url: string, headers: Record<string, string> = {}) {
  return app().getHttpAdapter().getInstance().inject({ method: 'GET', url, headers });
}

describe('health', () => {
  it('live returns 200 ok without touching dependencies', async () => {
    const response = await inject('/api/v1/health/live');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('ready returns 503 naming the parts that are down', async () => {
    const started = Date.now();
    const response = await inject('/api/v1/health/ready');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'down', db: 'down', redis: 'down' });
    // Both checks run in parallel with a 1 s cap each.
    expect(Date.now() - started).toBeLessThan(2500);
  });

  it('answers an unknown route with 404 not_found', async () => {
    const response = await inject('/api/v1/nope');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'not_found', message: 'We could not find that.' });
  });

  it('serves routes only under /api/v1', async () => {
    expect((await inject('/health/live')).statusCode).toBe(404);
  });

  it('echoes a safe x-request-id and replaces an unsafe one', async () => {
    const kept = await inject('/api/v1/health/live', { 'x-request-id': 'edge-123' });
    expect(kept.headers['x-request-id']).toBe('edge-123');
    const replaced = await inject('/api/v1/health/live', {
      'x-request-id': 'bad id\nwith newline',
    });
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
