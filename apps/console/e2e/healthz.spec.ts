import { expect, test } from '@playwright/test';

test('GET /healthz answers ok and is never cached', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('the console is never indexed, in any environment', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
});
