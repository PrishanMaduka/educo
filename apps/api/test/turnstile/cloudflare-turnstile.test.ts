import { describe, expect, it, vi } from 'vitest';

import {
  CloudflareTurnstile,
  SiteverifyResponse,
} from '../../src/common/turnstile/cloudflare-turnstile';
import { TURNSTILE_SITEVERIFY_URL } from '../../src/common/turnstile/turnstile';
import { fakeSiteverify, siteverifyResponse } from '../fakes/turnstile';

import type { TurnstileCheck } from '../../src/common/turnstile/turnstile';
import type { SiteverifyRequest } from '../fakes/turnstile';
import type { Logger } from 'pino';

const SECRET = '0x4AAAAAAAtest-only-turnstile-secret';
const TOKEN = 'token-from-the-widget-0123456789';
const CHECK: TurnstileCheck = { token: TOKEN, remoteIp: '203.0.113.7', action: 'demo-request' };

/** Cloudflare's documented success answer, for our host and action. */
const PASSED = {
  success: true,
  challenge_ts: '2026-10-10T09:00:00.000Z',
  hostname: 'quad-edu.com',
  'error-codes': [],
  action: 'demo-request',
  cdata: '',
  metadata: { interactive: false },
};

function fakeLogger() {
  const info = vi.fn();
  const warn = vi.fn();
  return { info, warn, logger: { info, warn } as unknown as Logger };
}

function verifierWith(
  respond: (request: SiteverifyRequest) => Promise<Response>,
  timeoutMs?: number,
) {
  const log = fakeLogger();
  const site = fakeSiteverify(respond);
  const verifier = new CloudflareTurnstile({
    secret: SECRET,
    expectedHostname: 'quad-edu.com',
    logger: log.logger,
    fetch: site.fetch,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  return { verifier, requests: site.requests, log };
}

const answering =
  (body: unknown, status = 200) =>
  () =>
    Promise.resolve(siteverifyResponse(body, status));

describe('CloudflareTurnstile (D57)', () => {
  it('passes a token Cloudflare accepts for our hostname and action', async () => {
    const { verifier } = verifierWith(answering(PASSED));
    await expect(verifier.verify(CHECK)).resolves.toEqual({ outcome: 'pass' });
  });

  it('fails a token Cloudflare rejects', async () => {
    const { verifier, log } = verifierWith(
      answering({ success: false, 'error-codes': ['invalid-input-response'] }),
    );
    await expect(verifier.verify(CHECK)).resolves.toEqual({ outcome: 'fail' });
    expect(log.info.mock.calls[0]?.[0]).toMatchObject({
      metric: 'turnstile_verify',
      outcome: 'fail',
      reason: 'rejected',
      errorCodes: ['invalid-input-response'],
    });
  });

  it('fails a token minted on another hostname', async () => {
    const { verifier, log } = verifierWith(answering({ ...PASSED, hostname: 'example.com' }));
    await expect(verifier.verify(CHECK)).resolves.toEqual({ outcome: 'fail' });
    expect(log.info.mock.calls[0]?.[0]).toMatchObject({ outcome: 'fail', reason: 'hostname' });
  });

  it('fails a token minted for another action', async () => {
    const { verifier, log } = verifierWith(answering({ ...PASSED, action: 'sign-up' }));
    await expect(verifier.verify(CHECK)).resolves.toEqual({ outcome: 'fail' });
    expect(log.info.mock.calls[0]?.[0]).toMatchObject({ outcome: 'fail', reason: 'action' });
  });

  it('is unavailable when siteverify does not answer in time, and aborts the request', async () => {
    let aborted = false;
    const { verifier, log } = verifierWith(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            aborted = true;
            reject(signal.reason as Error);
          });
        }),
      20,
    );
    await expect(verifier.verify(CHECK)).resolves.toEqual({ outcome: 'unavailable' });
    expect(aborted).toBe(true);
    expect(log.warn.mock.calls[0]?.[0]).toMatchObject({
      metric: 'turnstile_verify',
      outcome: 'unavailable',
      reason: 'timeout',
    });
  });

  it('waits 5 seconds by default', () => {
    expect(CloudflareTurnstile.DEFAULT_TIMEOUT_MS).toBe(5000);
  });

  it('is unavailable on a network error', async () => {
    const { verifier, log } = verifierWith(() => Promise.reject(new TypeError('fetch failed')));
    await expect(verifier.verify(CHECK)).resolves.toEqual({ outcome: 'unavailable' });
    expect(log.warn.mock.calls[0]?.[0]).toMatchObject({ reason: 'network' });
  });

  it('is unavailable when siteverify answers 500', async () => {
    const { verifier, log } = verifierWith(answering({ success: false }, 500));
    await expect(verifier.verify(CHECK)).resolves.toEqual({ outcome: 'unavailable' });
    expect(log.warn.mock.calls[0]?.[0]).toMatchObject({ reason: 'status', status: 500 });
  });

  it('is unavailable when the answer is not JSON, or not the siteverify shape', async () => {
    for (const respond of [
      () => Promise.resolve(new Response('<html>Bad gateway</html>', { status: 200 })),
      answering({ ok: true }),
    ]) {
      const { verifier, log } = verifierWith(respond);
      await expect(verifier.verify(CHECK)).resolves.toEqual({ outcome: 'unavailable' });
      expect(log.warn.mock.calls[0]?.[0]).toMatchObject({ reason: 'body' });
    }
  });

  it('never logs the token or the secret, whatever the outcome', async () => {
    const answers = [
      answering(PASSED),
      answering({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
      answering({}, 502),
      () => Promise.reject(new Error(`failed for ${TOKEN}`)),
    ];
    for (const respond of answers) {
      const { verifier, log } = verifierWith(respond);
      await verifier.verify(CHECK);
      const logged = JSON.stringify([log.info.mock.calls, log.warn.mock.calls]);
      expect(logged).not.toContain(TOKEN);
      expect(logged).not.toContain(SECRET);
      expect(logged).not.toContain(CHECK.remoteIp);
    }
  });
});

describe('siteverify contract (Cloudflare Turnstile server-side validation)', () => {
  it('posts the secret, token, remote IP and a fresh idempotency key as a form to the fixed URL', async () => {
    const { verifier, requests } = verifierWith(answering(PASSED));
    await verifier.verify(CHECK);
    await verifier.verify(CHECK);
    expect(TURNSTILE_SITEVERIFY_URL).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
    expect(requests).toHaveLength(2);
    const [first, second] = requests;
    expect(first?.url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(first?.method).toBe('POST');
    expect(first?.signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys(first?.form ?? {}).sort()).toEqual([
      'idempotency_key',
      'remoteip',
      'response',
      'secret',
    ]);
    expect(first?.form).toMatchObject({ secret: SECRET, response: TOKEN, remoteip: '203.0.113.7' });
    expect(first?.form.idempotency_key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second?.form.idempotency_key).not.toBe(first?.form.idempotency_key);
  });

  it("reads Cloudflare's documented success and failure answers", () => {
    expect(SiteverifyResponse.parse(PASSED)).toEqual({
      success: true,
      hostname: 'quad-edu.com',
      action: 'demo-request',
      'error-codes': [],
    });
    expect(
      SiteverifyResponse.parse({
        success: false,
        'error-codes': ['invalid-input-response'],
        messages: [],
      }),
    ).toEqual({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(SiteverifyResponse.parse({ success: false })).toEqual({
      success: false,
      'error-codes': [],
    });
  });

  it('refuses an answer without a boolean success', () => {
    for (const body of [{}, { success: 'true' }, null, []]) {
      expect(SiteverifyResponse.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});
