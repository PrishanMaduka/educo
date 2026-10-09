import { describe, expect, it } from 'vitest';

import { ApiError } from './api';
import { fetchPortalSession, sessionCookieHeader } from './portal-session';

import type { Me, MePermissions } from '@quad/contracts';

const ME: Me = {
  person: {
    name: 'Prishan Maduka',
    firstName: 'Prishan',
    theme: 'system',
    locale: 'en-LK',
    roleNames: ['School admin'],
  },
  school: {
    id: '0190a000-0000-7000-8000-0000000000b1',
    name: 'Colombo International School',
    shortName: 'CIS',
    timeZone: 'Asia/Colombo',
    brand: { color: '#DD4A42', fill: '#D0463E', fillDark: '#FF7A6E', ink: '#FFFFFF' },
  },
  memberships: [],
  preview: null,
  support: null,
  greeting: { period: 'morning', word: 'Good morning' },
};

const PERMISSIONS: MePermissions = {
  keys: ['settings.view', 'users.manage'],
  pages: [{ id: 'dashboard', access: 'full' }],
  home: 'dashboard',
  preview: null,
};

type Answer = { status: number; body?: unknown };

function fakeApi(answers: Record<string, Answer>, seen: Request[] = []): typeof fetch {
  return (input, init) => {
    const request = new Request(input, init);
    seen.push(request);
    const answer = answers[new URL(request.url).pathname] ?? { status: 599 };
    return Promise.resolve(
      new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
        status: answer.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
}

const API = 'http://api.internal:4000';

describe('fetchPortalSession', () => {
  it('reads GET /me and /me/permissions from the internal API with the session cookie', async () => {
    const seen: Request[] = [];
    const session = await fetchPortalSession({
      apiUrl: API,
      cookieHeader: 'quad_sid=s-1',
      fetch: fakeApi(
        {
          '/api/v1/me': { status: 200, body: ME },
          '/api/v1/me/permissions': { status: 200, body: PERMISSIONS },
        },
        seen,
      ),
    });
    expect(session).toEqual({ kind: 'ready', me: ME, permissions: PERMISSIONS });
    expect(seen.map((request) => request.url).sort()).toEqual([
      `${API}/api/v1/me`,
      `${API}/api/v1/me/permissions`,
    ]);
    for (const request of seen) expect(request.headers.get('cookie')).toBe('quad_sid=s-1');
  });

  it('is signed out when the API answers 401 (an expired or revoked session)', async () => {
    const session = await fetchPortalSession({
      apiUrl: API,
      cookieHeader: 'quad_sid=old',
      fetch: fakeApi({
        '/api/v1/me': { status: 401, body: { code: 'unauthorized', message: 'x' } },
        '/api/v1/me/permissions': { status: 401, body: { code: 'unauthorized', message: 'x' } },
      }),
    });
    expect(session).toEqual({ kind: 'signed_out' });
  });

  it('gives the reason when the school is paused (403 school_suspended)', async () => {
    const paused = { code: 'school_suspended', message: 'Paused for an unpaid invoice.' };
    const session = await fetchPortalSession({
      apiUrl: API,
      cookieHeader: 'quad_sid=s-1',
      fetch: fakeApi({
        '/api/v1/me': { status: 403, body: paused },
        '/api/v1/me/permissions': { status: 403, body: paused },
      }),
    });
    expect(session).toEqual({ kind: 'suspended', reason: 'Paused for an unpaid invoice.' });
  });

  it('throws any other failure, so the error page shows instead of a half-built shell', async () => {
    await expect(
      fetchPortalSession({
        apiUrl: API,
        cookieHeader: 'quad_sid=s-1',
        fetch: fakeApi({
          '/api/v1/me': { status: 200, body: ME },
          '/api/v1/me/permissions': { status: 500, body: { code: 'internal', message: 'x' } },
        }),
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('refuses a /me the contract does not accept, so no unchecked brand value reaches a style', async () => {
    const forged = {
      ...ME,
      school: { ...ME.school, brand: { ...ME.school.brand, fill: 'red; background: url(x)' } },
    };
    await expect(
      fetchPortalSession({
        apiUrl: API,
        cookieHeader: 'quad_sid=s-1',
        fetch: fakeApi({
          '/api/v1/me': { status: 200, body: forged },
          '/api/v1/me/permissions': { status: 200, body: PERMISSIONS },
        }),
      }),
    ).rejects.toThrow('GET /me answered');
  });

  it('refuses /me/permissions the contract does not accept', async () => {
    await expect(
      fetchPortalSession({
        apiUrl: API,
        cookieHeader: 'quad_sid=s-1',
        fetch: fakeApi({
          '/api/v1/me': { status: 200, body: ME },
          '/api/v1/me/permissions': { status: 200, body: { ...PERMISSIONS, home: 42 } },
        }),
      }),
    ).rejects.toThrow(/GET \/me\/permissions/);
  });
});

describe('sessionCookieHeader', () => {
  it('forwards only the session cookies to the API', () => {
    expect(
      sessionCookieHeader([
        { name: 'quad_sid', value: 's-1' },
        { name: 'quad_csrf', value: 'c-1' },
        { name: 'quad_last_school', value: '%7B%7D' },
        { name: '_ga', value: 'tracker' },
      ]),
    ).toBe('quad_sid=s-1');
    expect(sessionCookieHeader([{ name: '__Host-quad_sid', value: 's-2' }])).toBe(
      '__Host-quad_sid=s-2',
    );
    expect(sessionCookieHeader([])).toBe('');
  });
});
