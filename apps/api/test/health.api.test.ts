import { describe, expect, it } from 'vitest';

import { useTestApp } from './app';

// The compose Postgres and Redis: DATABASE_URL / REDIS_URL when set (CI), else local defaults.
const fromEnv = Object.fromEntries(
  (['DATABASE_URL', 'REDIS_URL'] as const).flatMap((name) => {
    const value = process.env[name];
    return value ? [[name, value]] : [];
  }),
);
const app = useTestApp(fromEnv);

describe('health against the compose services', () => {
  it('ready returns 200 when Postgres and Redis answer', async () => {
    const response = await app()
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', db: 'ok', redis: 'ok' });
  });
});
