import { describe, expect, it } from 'vitest';

import { apiQueryOptions, createApiClient } from './index';

function stubFetch(body: unknown, seen: Request[] = []): typeof fetch {
  return (input, init) => {
    seen.push(new Request(input, init));
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
}

describe('createApiClient', () => {
  it('calls a typed path on the given origin and returns the data', async () => {
    const seen: Request[] = [];
    const client = createApiClient('http://localhost:3000', {
      fetch: stubFetch({ status: 'ok' }, seen),
    });
    const result = await client.GET('/api/v1/health/live');
    expect(result.data).toEqual({ status: 'ok' });
    expect(seen[0]?.url).toBe('http://localhost:3000/api/v1/health/live');
  });

  it('rejects unknown paths at type level', async () => {
    const client = createApiClient('http://localhost:3000', { fetch: stubFetch({}) });
    // @ts-expect-error not a documented path
    await client.GET('/api/v1/nope');
  });
});

describe('apiQueryOptions', () => {
  it('builds health/live query options that fetch through the client', async () => {
    const client = createApiClient('http://localhost:3000', { fetch: stubFetch({ status: 'ok' }) });
    const options = apiQueryOptions.healthLive(client);
    expect(options.queryKey).toEqual(['health', 'live']);
    const data = await options.queryFn();
    expect(data).toEqual({ status: 'ok' });
  });
});
