import { describe, expect, it } from 'vitest';

import { ApiError, createStaffApi, unwrap, unwrapEmpty } from './api';

function recordingFetch(status: number, body: unknown, seen: Request[]): typeof fetch {
  return (input, init) => {
    seen.push(new Request(input, init));
    return Promise.resolve(
      status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
    );
  };
}

describe('createStaffApi', () => {
  it('echoes the CSRF cookie in X-CSRF-Token on writes, not on reads', async () => {
    const seen: Request[] = [];
    const api = createStaffApi('http://localhost:3000', {
      fetch: recordingFetch(200, { items: [] }, seen),
      cookies: () => 'quad_csrf=tok-1',
    });
    await api.GET('/api/v1/auth/memberships');
    await api.POST('/api/v1/auth/select-school', {
      body: { tenantId: '0190a000-0000-7000-8000-000000000001', remember: false },
    });
    expect(seen[0]?.headers.get('x-csrf-token')).toBeNull();
    expect(seen[1]?.headers.get('x-csrf-token')).toBe('tok-1');
    expect(seen[1]?.credentials).toBe('same-origin');
  });

  it('sends no header when there is no CSRF cookie yet (the password step)', async () => {
    const seen: Request[] = [];
    const api = createStaffApi('http://localhost:3000', {
      fetch: recordingFetch(200, { next: 'two_step' }, seen),
      cookies: () => '',
    });
    await api.POST('/api/v1/auth/password', {
      body: { email: 'a@b.co', password: 'x', keepSignedIn: false },
    });
    expect(seen[0]?.headers.get('x-csrf-token')).toBeNull();
  });
});

describe('unwrap', () => {
  const api = (status: number, body: unknown) =>
    createStaffApi('http://localhost:3000', {
      fetch: recordingFetch(status, body, []),
      cookies: () => '',
    });

  it('gives the data of a success, and nothing for 204', async () => {
    expect(
      await unwrap(
        api(200, { next: 'done' }).POST('/api/v1/auth/password', {
          body: { email: 'a@b.co', password: 'x', keepSignedIn: false },
        }),
      ),
    ).toEqual({ next: 'done' });
    await expect(
      unwrapEmpty(api(204, null).POST('/api/v1/auth/sign-out')),
    ).resolves.toBeUndefined();
  });

  it('throws the API’s code and field messages', async () => {
    const error = await unwrap(
      api(400, { code: 'validation', message: 'Check the form', fields: { email: 'Bad' } }).POST(
        '/api/v1/auth/password/forgot',
        { body: { email: 'a@b.co' } },
      ),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'validation', status: 400, fields: { email: 'Bad' } });
  });

  it('treats a body that is not an API error as an internal error', async () => {
    const error = await unwrap(
      api(502, 'Bad gateway').POST('/api/v1/auth/password/forgot', { body: { email: 'a@b.co' } }),
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'internal', status: 502, fields: {} });
  });
});
