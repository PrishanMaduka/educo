import { describe, expect, it } from 'vitest';

import { apiRewrites } from './api-rewrites';

describe('apiRewrites', () => {
  it('proxies the API routes and the Socket.IO path to the API', () => {
    expect(apiRewrites('http://localhost:4000')).toEqual([
      { source: '/api/v1/:path*', destination: 'http://localhost:4000/api/v1/:path*' },
      { source: '/socket.io', destination: 'http://localhost:4000/socket.io' },
    ]);
  });
});
