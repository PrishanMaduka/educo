import { describe, expect, it } from 'vitest';

import { CLOSED_PORTS, useTestApp } from './app';
import { productionEnv } from './env';

/** Staging as the config accepts it (real-length secrets), with nothing listening on the ports. */
const STAGING = productionEnv({
  APP_ENV: 'staging',
  DATABASE_URL: 'postgres://quad_app:staging-app-password@127.0.0.1:1/quad',
  DATABASE_PLATFORM_URL: 'postgres://quad_platform:staging-platform-password@127.0.0.1:1/quad',
  REDIS_URL: CLOSED_PORTS.REDIS_URL,
});

describe('X-Robots-Tag on API responses', () => {
  const staging = useTestApp(STAGING);
  const local = useTestApp(CLOSED_PORTS);

  it('asks search engines not to index staging', async () => {
    const response = await staging()
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('also covers error responses on staging', async () => {
    const response = await staging()
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url: '/api/v1/no-such-route' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('sends no robots header locally', async () => {
    const response = await local()
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.headers).not.toHaveProperty('x-robots-tag');
  });
});
