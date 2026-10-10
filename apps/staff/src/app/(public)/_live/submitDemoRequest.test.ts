import { DemoRequestBody } from '@quad/contracts/public';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { submitDemoRequest } from './submitDemoRequest';

const BODY = DemoRequestBody.parse({
  kind: 'school',
  name: 'Sample Person',
  email: 'name@school.org',
  school: 'Sample School',
  students: 'under_300',
  curriculum: 'ib',
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  website: '',
});

const fetchMock = vi.fn<typeof fetch>();

function answer(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('submitDemoRequest (POST /api/v1/public/demo-requests, spec 19 "Demo requests")', () => {
  it('posts the body as JSON, without the session, and reports 202 as sent', async () => {
    fetchMock.mockResolvedValue(answer(202));
    await expect(submitDemoRequest(BODY)).resolves.toEqual({ kind: 'sent' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/public/demo-requests');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(typeof init?.body === 'string' && JSON.parse(init.body)).toEqual(BODY);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports the refused paths of a 400 validation', async () => {
    fetchMock.mockResolvedValue(
      answer(400, {
        code: 'validation',
        message: 'Check the highlighted fields.',
        fields: { email: 'Invalid', _root: 'Unrecognized key' },
      }),
    );
    await expect(submitDemoRequest(BODY)).resolves.toEqual({
      kind: 'invalid',
      paths: ['email', '_root'],
    });
  });

  it.each([
    [400, { code: 'captcha_failed', message: 'x' }, 'captcha_failed'],
    [429, { code: 'rate_limited', message: 'x' }, 'rate_limited'],
    [503, { code: 'captcha_unavailable', message: 'x' }, 'unavailable'],
    [500, { code: 'internal', message: 'x' }, 'unavailable'],
    [400, { code: 'something_new', message: 'x' }, 'unavailable'],
    [400, 'not an error body', 'unavailable'],
    [404, undefined, 'unavailable'],
  ] as const)('reports %i %j as %s', async (status, body, kind) => {
    fetchMock.mockResolvedValue(answer(status, body));
    await expect(submitDemoRequest(BODY)).resolves.toEqual({ kind });
  });

  it('reports a body that is not JSON as unavailable', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 400 }));
    await expect(submitDemoRequest(BODY)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('reports a network error as unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(submitDemoRequest(BODY)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('gives up after the timeout and reports it as unavailable', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation timed out.', 'TimeoutError'));
          });
        }),
    );
    await expect(submitDemoRequest(BODY, { timeoutMs: 20 })).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});
