import { expect, test } from '@playwright/test';

// Response headers do not depend on the screen size or colour scheme: one project is enough.
test.skip(({ viewport, colorScheme }) => colorScheme !== 'light' || (viewport?.width ?? 0) < 900);

test('GET /healthz answers ok and is never cached', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toEqual({ status: 'ok' });
});

test('the console is never indexed, in any environment', async ({ request }) => {
  for (const path of ['/healthz', '/no-such-page']) {
    const response = await request.get(path);
    expect(response.headers()['x-robots-tag'], path).toBe('noindex, nofollow');
  }
});
