import { describe, expect, it } from 'vitest';

import {
  ApiError,
  cookieValue,
  createBrowserApi,
  fieldError,
  filenameFrom,
  isFieldError,
  safeReturnPath,
  unwrap,
  unwrapEmpty,
} from './browser';

function recordingFetch(status: number, body: unknown, seen: Request[] = []): typeof fetch {
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

const CONSOLE_CSRF = ['quad_console_csrf', '__Host-quad_console_csrf'] as const;

describe('cookieValue', () => {
  it('reads the first named cookie, whichever of the names it has', () => {
    expect(cookieValue('a=1; quad_console_csrf=tok; b=2', CONSOLE_CSRF)).toBe('tok');
    expect(cookieValue('__Host-quad_console_csrf=prod', CONSOLE_CSRF)).toBe('prod');
  });

  it('ignores a cookie whose name only contains a wanted name', () => {
    expect(cookieValue('xquad_console_csrf=no; quad_csrf=staff', CONSOLE_CSRF)).toBeNull();
    expect(cookieValue('', CONSOLE_CSRF)).toBeNull();
  });
});

describe('createBrowserApi', () => {
  it('echoes the named CSRF cookie in X-CSRF-Token on writes, not on reads', async () => {
    const seen: Request[] = [];
    const api = createBrowserApi('http://localhost:3001', {
      csrfCookies: CONSOLE_CSRF,
      fetch: recordingFetch(200, {}, seen),
      // The staff portal's cookie on the same host must never be sent as the console's.
      cookies: () => 'quad_csrf=staff; quad_console_csrf=console',
    });
    await api.GET('/api/v1/platform/me');
    await api.POST('/api/v1/platform/auth/sign-out', { body: {} });
    expect(seen[0]?.headers.get('x-csrf-token')).toBeNull();
    expect(seen[1]?.headers.get('x-csrf-token')).toBe('console');
    expect(seen[1]?.credentials).toBe('same-origin');
  });

  it('sends no header before the CSRF cookie exists (the password step)', async () => {
    const seen: Request[] = [];
    const api = createBrowserApi('http://localhost:3001', {
      csrfCookies: CONSOLE_CSRF,
      fetch: recordingFetch(200, { next: 'two_step' }, seen),
      cookies: () => '',
    });
    await api.POST('/api/v1/platform/auth/password', { body: { email: 'a@b.co', password: 'x' } });
    expect(seen[0]?.headers.get('x-csrf-token')).toBeNull();
  });
});

describe('unwrap and unwrapEmpty', () => {
  const api = (status: number, body: unknown) =>
    createBrowserApi('http://localhost:3001', {
      csrfCookies: CONSOLE_CSRF,
      fetch: recordingFetch(status, body),
      cookies: () => '',
    });

  it('gives the data of a success', async () => {
    expect(await unwrap(api(200, { id: 'x' }).GET('/api/v1/platform/me'))).toEqual({ id: 'x' });
  });

  it('throws the API error with its code, status and field messages', async () => {
    const error = await unwrap(
      api(400, {
        code: 'validation',
        message: 'Check the form',
        fields: { reason: 'Too short' },
      }).GET('/api/v1/platform/me'),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'validation', status: 400, message: 'Check the form' });
    expect(fieldError(error, 'reason')).toBe('Too short');
    expect(isFieldError(error)).toBe(true);
  });

  it('calls a body that is not an API error (a proxy page) internal', async () => {
    const error = await unwrap(api(502, 'Bad gateway').GET('/api/v1/platform/me')).catch(
      (caught: unknown) => caught,
    );
    expect(error).toMatchObject({ code: 'internal', status: 502 });
    expect(fieldError(error, 'reason')).toBeUndefined();
    expect(isFieldError(error)).toBe(false);
  });

  it('accepts a 204 with no body, and throws for a refusal', async () => {
    await expect(
      unwrapEmpty(api(204, null).POST('/api/v1/platform/auth/sign-out', { body: {} })),
    ).resolves.toBeUndefined();
    await expect(
      unwrapEmpty(
        api(401, { code: 'unauthenticated', message: 'Sign in' }).POST(
          '/api/v1/platform/auth/sign-out',
          { body: {} },
        ),
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated', status: 401 });
  });
});

describe('filenameFrom', () => {
  it('reads the file name the API gives an export, or the fallback', () => {
    const named = new Response('', {
      headers: {
        'content-disposition': 'attachment; filename="quad-platform-audit-2026-10-10.csv"',
      },
    });
    expect(filenameFrom(named, 'audit.csv')).toBe('quad-platform-audit-2026-10-10.csv');
    expect(filenameFrom(new Response(''), 'audit.csv')).toBe('audit.csv');
  });
});

describe('safeReturnPath (where a web app may send someone after sign-in)', () => {
  const console = { allow: (path: string) => !path.startsWith('/sign-in'), fallback: '/' };

  it.each(['/', '/audit?actor=a&b=1', '/schools#top', '/%09/x'])('keeps %s as it is', (raw) => {
    expect(safeReturnPath(raw, console)).toBe(raw);
  });

  it.each([
    undefined,
    42,
    '',
    'audit',
    'https://evil.example/',
    '//evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r/evil.example',
    '/\u0000/x',
    '/\u001f/x',
    '/\u007f/x',
    '/\\evil',
    '/a/../sign-in',
    '/./a',
    '/sign-in',
  ])('refuses %j', (raw) => {
    expect(safeReturnPath(raw, console)).toBe('/');
  });
});
