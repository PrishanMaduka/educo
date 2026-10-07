import { describe, expect, it } from 'vitest';

import { parseSmokeArgs, runSmoke, type SmokeOptions } from '../smoke.mjs';

type FakeResponse = { status: number; headers?: Record<string, string>; body?: string };

const html = { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' };
const json = { 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow' };

const green = (): Record<string, FakeResponse> => ({
  'https://api.test/api/v1/health/ready': { status: 200, headers: json, body: '{"status":"ok"}' },
  'https://web.test/': { status: 200, headers: html, body: '<html></html>' },
  'https://web.test/app': { status: 307, headers: { ...html, location: '/sign-in?next=/app' } },
  'https://console.test/': { status: 200, headers: html, body: '<html></html>' },
  'https://origin.test/api/v1/health/live': { status: 403, body: 'Forbidden' },
});

/** A fake `fetch` answering from a table of URL → response; anything else is a network error. */
const fakeFetch = (table: Record<string, FakeResponse>) =>
  ((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const entry = table[url];
    if (!entry) return Promise.reject(new TypeError(`fetch failed: ${url}`));
    const body = entry.status === 307 || entry.status === 302 ? null : (entry.body ?? '');
    return Promise.resolve(
      new Response(body, { status: entry.status, headers: entry.headers ?? {} }),
    );
  }) as typeof fetch;

const okSocket = () => Promise.resolve('0{"sid":"abc","upgrades":[],"pingInterval":25000}');

const base: SmokeOptions = {
  web: 'https://web.test',
  console: 'https://console.test',
  api: 'https://api.test',
  robots: 'ignore',
  timeoutMs: 10_000,
};

const byName = (results: { name: string; ok: boolean; detail: string }[], name: string) =>
  results.find((r) => r.name === name);

describe('parseSmokeArgs', () => {
  it('defaults --api to --web, robots to ignore and the timeout to 10 s', () => {
    expect(parseSmokeArgs(['--web', 'https://w', '--console', 'https://c'])).toEqual({
      web: 'https://w',
      console: 'https://c',
      api: 'https://w',
      robots: 'ignore',
      timeoutMs: 10_000,
    });
  });

  it('reads --api, --origin and --expect-noindex', () => {
    expect(
      parseSmokeArgs([
        '--web',
        'https://w/',
        '--console',
        'https://c',
        '--api',
        'https://a',
        '--origin',
        'https://o',
        '--expect-noindex',
      ]),
    ).toEqual({
      web: 'https://w',
      console: 'https://c',
      api: 'https://a',
      origin: 'https://o',
      robots: 'noindex',
      timeoutMs: 10_000,
    });
  });

  it('reads --expect-indexable', () => {
    expect(
      parseSmokeArgs(['--web', 'https://w', '--console', 'https://c', '--expect-indexable']).robots,
    ).toBe('indexable');
  });

  it.each([
    [['--console', 'https://c']],
    [['--web', 'https://w']],
    [['--web', 'https://w', '--console', 'https://c', '--expect-noindex', '--expect-indexable']],
    [['--web', 'https://w', '--console', 'https://c', '--bogus']],
    [['--web', 'not a url', '--console', 'https://c']],
    [['--web', '--console', 'https://c']],
  ])('refuses %j', (argv) => {
    expect(() => parseSmokeArgs(argv)).toThrow();
  });
});

describe('runSmoke', () => {
  it('passes all seven checks, in order, with --origin', async () => {
    const results = await runSmoke(
      { ...base, origin: 'https://origin.test', robots: 'noindex' },
      { fetch: fakeFetch(green()), openWebSocket: okSocket },
    );
    expect(results.map((r) => r.name)).toEqual([
      'ready',
      'landing',
      'portal',
      'console',
      'robots',
      'websocket',
      'origin-refused',
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('runs six checks without --origin', async () => {
    const results = await runSmoke(base, { fetch: fakeFetch(green()), openWebSocket: okSocket });
    expect(results).toHaveLength(6);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('opens the socket on the API host with ws for http and wss for https', async () => {
    const urls: string[] = [];
    const record = async (url: string) => {
      urls.push(url);
      return okSocket();
    };
    await runSmoke(base, { fetch: fakeFetch(green()), openWebSocket: record });
    const local = { ...green() } as Record<string, FakeResponse>;
    local['http://localhost:4000/api/v1/health/ready'] =
      local['https://api.test/api/v1/health/ready']!;
    await runSmoke(
      { ...base, api: 'http://localhost:4000' },
      { fetch: fakeFetch(local), openWebSocket: record },
    );
    expect(urls).toEqual([
      'wss://api.test/socket.io/?EIO=4&transport=websocket',
      'ws://localhost:4000/socket.io/?EIO=4&transport=websocket',
    ]);
  });

  it('accepts a 200 HTML portal', async () => {
    const table = green();
    table['https://web.test/app'] = { status: 200, headers: html, body: '<html></html>' };
    const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
    expect(byName(results, 'portal')?.ok).toBe(true);
  });

  it('refuses a portal redirect that does not go to /sign-in', async () => {
    const table = green();
    table['https://web.test/app'] = { status: 307, headers: { location: '/elsewhere' } };
    const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
    expect(byName(results, 'portal')).toMatchObject({ ok: false });
    expect(byName(results, 'portal')?.detail).toContain('/elsewhere');
  });

  it.each(['https://web.test/sign-in?next=%2Fapp', '/sign-in/', '/sign-in#otp'])(
    'accepts a portal redirect to %s',
    async (location) => {
      const table = green();
      table['https://web.test/app'] = { status: 303, headers: { location } };
      const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
      expect(byName(results, 'portal')?.ok).toBe(true);
    },
  );

  it.each(['/sign-inx', '//evil.test/sign-in', '', '/app/sign-in'])(
    'refuses a portal redirect to %j',
    async (location) => {
      const table = green();
      table['https://web.test/app'] = { status: 307, headers: { location } };
      const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
      expect(byName(results, 'portal')?.ok).toBe(false);
    },
  );

  it('refuses a portal 301, even to /sign-in', async () => {
    const table = green();
    table['https://web.test/app'] = { status: 301, headers: { location: '/sign-in' } };
    const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
    expect(byName(results, 'portal')?.ok).toBe(false);
  });

  it('refuses a portal redirect to /sign-in on another host', async () => {
    const table = green();
    table['https://web.test/app'] = {
      status: 302,
      headers: { location: 'https://evil.test/sign-in' },
    };
    const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
    expect(byName(results, 'portal')?.ok).toBe(false);
  });

  it('fails ready when the status is not ok', async () => {
    const table = green();
    table['https://api.test/api/v1/health/ready'] = {
      status: 200,
      headers: json,
      body: '{"status":"degraded"}',
    };
    const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
    expect(byName(results, 'ready')?.ok).toBe(false);
  });

  it('fails landing when it is not HTML', async () => {
    const table = green();
    table['https://web.test/'] = { status: 200, headers: json, body: '{}' };
    const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
    expect(byName(results, 'landing')?.ok).toBe(false);
  });

  it('fails a check without throwing when the host cannot be reached', async () => {
    const table = green();
    delete table['https://console.test/'];
    const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
    expect(byName(results, 'console')).toMatchObject({ ok: false });
    expect(byName(results, 'console')?.detail).toContain('fetch failed');
  });

  it('names the page missing the noindex header', async () => {
    const table = green();
    table['https://console.test/'] = {
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: '<html></html>',
    };
    const results = await runSmoke(
      { ...base, robots: 'noindex' },
      { fetch: fakeFetch(table), openWebSocket: okSocket },
    );
    const robots = byName(results, 'robots');
    expect(robots?.ok).toBe(false);
    expect(robots?.detail).toContain('console');
    expect(robots?.detail).not.toContain('landing');
  });

  it('fails indexable mode when a page says noindex', async () => {
    const results = await runSmoke(
      { ...base, robots: 'indexable' },
      { fetch: fakeFetch(green()), openWebSocket: okSocket },
    );
    expect(byName(results, 'robots')?.ok).toBe(false);
  });

  it('passes indexable mode when only the console says noindex', async () => {
    const table = green();
    const plain = { 'content-type': 'text/html' };
    table['https://api.test/api/v1/health/ready'] = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"status":"ok"}',
    };
    table['https://web.test/'] = { status: 200, headers: plain };
    table['https://web.test/app'] = { status: 307, headers: { location: '/sign-in' } };
    const results = await runSmoke(
      { ...base, robots: 'indexable' },
      { fetch: fakeFetch(table), openWebSocket: okSocket },
    );
    expect(byName(results, 'robots')?.ok).toBe(true);
  });

  // spec 02 D28: robotsTagFor marks the console noindex in every environment, production included.
  it('fails indexable mode when the console is indexable', async () => {
    const table = green();
    table['https://console.test/'] = { status: 200, headers: { 'content-type': 'text/html' } };
    table['https://api.test/api/v1/health/ready'] = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"status":"ok"}',
    };
    table['https://web.test/'] = { status: 200, headers: { 'content-type': 'text/html' } };
    table['https://web.test/app'] = { status: 307, headers: { location: '/sign-in' } };
    const results = await runSmoke(
      { ...base, robots: 'indexable' },
      { fetch: fakeFetch(table), openWebSocket: okSocket },
    );
    expect(byName(results, 'robots')).toMatchObject({ ok: false });
    expect(byName(results, 'robots')?.detail).toContain('console');
  });

  it('ignores the robots header by default', async () => {
    const table = green();
    table['https://web.test/'] = { status: 200, headers: { 'content-type': 'text/html' } };
    const results = await runSmoke(base, { fetch: fakeFetch(table), openWebSocket: okSocket });
    expect(byName(results, 'robots')?.ok).toBe(true);
  });

  it('fails websocket when the first message is not the Engine.IO open packet', async () => {
    const results = await runSmoke(base, {
      fetch: fakeFetch(green()),
      openWebSocket: () => Promise.resolve('40'),
    });
    expect(byName(results, 'websocket')).toMatchObject({ ok: false });
  });

  it('fails websocket when the socket cannot open', async () => {
    const results = await runSmoke(base, {
      fetch: fakeFetch(green()),
      openWebSocket: () => Promise.reject(new Error('connection refused')),
    });
    expect(byName(results, 'websocket')?.detail).toContain('connection refused');
  });

  // Review Focus #1: the ALB must refuse a request that did not come through CloudFront.
  it.each([200, 301, 404, 502])(
    'fails origin-refused when the origin answers %i',
    async (status) => {
      const table = green();
      table['https://origin.test/api/v1/health/live'] = { status, body: '{"status":"ok"}' };
      const results = await runSmoke(
        { ...base, origin: 'https://origin.test' },
        { fetch: fakeFetch(table), openWebSocket: okSocket },
      );
      expect(byName(results, 'origin-refused')).toMatchObject({ ok: false });
    },
  );

  it('does not follow redirects or send the origin header', async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    const inner = fakeFetch(green());
    const spy = ((input: string, init?: RequestInit) => {
      seen.push({ url: input, init });
      return inner(input, init);
    }) as typeof fetch;
    await runSmoke(
      { ...base, origin: 'https://origin.test' },
      { fetch: spy, openWebSocket: okSocket },
    );
    expect(seen).toHaveLength(5);
    for (const { init } of seen) {
      expect(init?.redirect).toBe('manual');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.stringify(init?.headers ?? {}).toLowerCase()).not.toContain('x-quad-origin');
    }
  });
});
