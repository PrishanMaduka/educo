import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { runWithRequestContext } from '../src/common/request-context';
import { loadConfig } from '../src/config';

import { CLOSED_PORTS, captureLogs } from './app';
import { localEnv } from './env';

describe('logger', () => {
  it('adds requestId, tenantId and userId inside a request', () => {
    const { lines, logger } = captureLogs();
    runWithRequestContext('req-1', () => {
      logger.info('inside');
    });
    logger.info('outside');
    expect(lines[0]).toMatchObject({
      msg: 'inside',
      requestId: 'req-1',
      tenantId: null,
      userId: null,
    });
    expect(lines[1]).not.toHaveProperty('requestId');
    expect(lines[0]).toMatchObject({ level: 'info', service: 'api' });
  });

  it('redacts personal data and credentials if they are ever passed', () => {
    const { lines, logger } = captureLogs();
    logger.info({ user: { email: 'a@b.c', phone: '+94770000001' }, password: 'x' }, 'redacted');
    const line = JSON.stringify(lines[0]);
    expect(line).not.toContain('a@b.c');
    expect(line).not.toContain('+94770000001');
    expect(lines[0]).toMatchObject({ password: '[redacted]' });
  });

  it('redacts the CloudFront origin secret header if request headers are ever logged', () => {
    const { lines, logger } = captureLogs();
    logger.info({ headers: { 'x-quad-origin-secret': 'origin-secret-1' } }, 'top level');
    logger.info({ req: { headers: { 'x-quad-origin-secret': 'origin-secret-2' } } }, 'nested');
    const text = JSON.stringify(lines);
    expect(text).not.toContain('origin-secret-1');
    expect(text).not.toContain('origin-secret-2');
    expect(lines[0]).toMatchObject({ headers: { 'x-quad-origin-secret': '[redacted]' } });
  });

  it('logs each request with its id and route template, not the raw URL', async () => {
    const { lines, logger } = captureLogs();
    const app = await createApp(loadConfig(localEnv(CLOSED_PORTS)), { logger });
    try {
      await app
        .getHttpAdapter()
        .getInstance()
        .inject({
          method: 'GET',
          url: '/api/v1/health/live?token=abc',
          headers: { 'x-request-id': 'req-9' },
        });
    } finally {
      await app.close();
    }
    const line = lines.find((l) => l.msg === 'Request completed');
    expect(line).toMatchObject({
      requestId: 'req-9',
      tenantId: null,
      userId: null,
      method: 'GET',
      route: '/api/v1/health/live',
      statusCode: 200,
    });
    expect(JSON.stringify(line)).not.toContain('token=abc');
  });
});
