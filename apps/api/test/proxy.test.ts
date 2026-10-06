import { describe, expect, it } from 'vitest';

import { CLOSED_PORTS, useTestApp } from './app';

import type { CreateAppOptions } from '../src/app';

/** A test-only route that echoes the client IP Fastify derived. */
const echoIp: CreateAppOptions = {
  beforeInit: (fastify) => {
    fastify.get('/test/ip', (request) => ({ ip: request.ip }));
  },
};

const request = {
  method: 'GET' as const,
  url: '/test/ip',
  remoteAddress: '10.0.0.1',
  headers: { 'x-forwarded-for': '6.6.6.6, 10.0.0.5' },
};

describe('client IP behind proxies (TRUST_PROXY_HOPS)', () => {
  const oneHop = useTestApp({ ...CLOSED_PORTS, TRUST_PROXY_HOPS: '1' }, echoIp);
  const noProxy = useTestApp(CLOSED_PORTS, echoIp);

  it('trusts only the configured number of hops, so a spoofed leftmost entry is ignored', async () => {
    const response = await oneHop().getHttpAdapter().getInstance().inject(request);
    expect(response.json()).toEqual({ ip: '10.0.0.5' });
  });

  it('ignores X-Forwarded-For entirely by default', async () => {
    const response = await noProxy().getHttpAdapter().getInstance().inject(request);
    expect(response.json()).toEqual({ ip: '10.0.0.1' });
  });
});
