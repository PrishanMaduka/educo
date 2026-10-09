import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { Mailpit, linkIn, recipientQuery, tokenOf } from '../playwright/mailpit';
import { expiredTestLink, signTestLink, tamperedTestLink } from '../playwright/signed-token';
import { clientAddressFor } from '../playwright/stack';
import { stackSecrets } from '../playwright/stack-secrets';

const decode = (token: string): unknown =>
  JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8'));

describe('signed-token helper', () => {
  const payload = { purpose: 'password_reset', tid: null, sub: 'account-1', nonce: 'n1' };

  it('signs base64url(payload).base64url(HMAC-SHA256(segment)) with the stack’s secret', () => {
    const token = signTestLink({ ...payload, exp: 2_000_000_000 });
    const [segment, mac] = token.split('.');
    const expected = createHmac('sha256', stackSecrets().linkSigningSecret)
      .update(segment ?? '', 'ascii')
      .digest('base64url');
    expect(mac).toBe(expected);
    expect(decode(token)).toEqual({ ...payload, exp: 2_000_000_000 });
  });

  it('gives an expired link an exp in the past', () => {
    const now = new Date('2026-10-09T12:00:00Z');
    expect(decode(expiredTestLink(payload, { now, secondsAgo: 60 }))).toMatchObject({
      exp: Math.floor(now.getTime() / 1000) - 60,
    });
  });

  it('makes a fresh nonce per link unless one is given', () => {
    const rest = { purpose: payload.purpose, tid: payload.tid, sub: payload.sub };
    const a = decode(signTestLink({ ...rest, exp: null })) as { nonce: string };
    const b = decode(signTestLink({ ...rest, exp: null })) as { nonce: string };
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('tampers with the payload but keeps the original signature', () => {
    const original = signTestLink({ ...payload, exp: 2_000_000_000 });
    const tampered = tamperedTestLink({ ...payload, exp: 2_000_000_000 });
    expect(tampered.split('.')[1]).toBe(original.split('.')[1]);
    expect(decode(tampered)).toMatchObject({ sub: 'account-1-changed' });
  });
});

describe('mailpit helper', () => {
  it('searches by exact recipient', () => {
    expect(recipientQuery('new.teacher+r1@colombo-intl.local')).toBe(
      'to:"new.teacher+r1@colombo-intl.local"',
    );
  });

  it('finds the link with the given path in a message, and its token', () => {
    const text =
      'Hello,\nOpen http://localhost:3000/help first, then\nhttp://localhost:3000/sign-in/reset/abc.def\n';
    const link = linkIn(text, '/sign-in/reset/');
    expect(link).toBe('http://localhost:3000/sign-in/reset/abc.def');
    expect(tokenOf(link ?? '')).toBe('abc.def');
    expect(linkIn(text, '/sign-in/invite/')).toBeNull();
  });

  it('picks the newest message to the address that arrived since a moment', async () => {
    const calls: string[] = [];
    const fake = ((url: string) => {
      calls.push(url);
      const body = url.includes('/search')
        ? {
            messages: [
              { ID: 'new', Created: '2026-10-09T12:00:05Z', Subject: 'Reset your Quad password' },
              { ID: 'old', Created: '2026-10-09T11:00:00Z', Subject: 'Reset your Quad password' },
            ],
          }
        : {
            ID: 'new',
            Subject: 'Reset your Quad password',
            To: [{ Address: 'a@b.local' }],
            Text: 'text',
            HTML: '<p>html</p>',
          };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }) as typeof fetch;
    const mailpit = new Mailpit('http://mailpit.test', fake);

    const message = await mailpit.waitForMessage({
      to: 'a@b.local',
      since: new Date('2026-10-09T12:00:00Z'),
      subject: 'Reset',
    });

    expect(message).toEqual({
      id: 'new',
      subject: 'Reset your Quad password',
      to: ['a@b.local'],
      text: 'text',
      html: '<p>html</p>',
    });
    expect(calls[0]).toBe(
      `http://mailpit.test/api/v1/search?query=${encodeURIComponent('to:"a@b.local"')}`,
    );
    expect(
      await mailpit.newest({ to: 'a@b.local', since: new Date('2026-10-09T13:00:00Z') }),
    ).toBeNull();
  });
});

describe('clientAddressFor', () => {
  it('gives each test, project and retry its own private address', () => {
    const one = clientAddressFor('test-a', 'desktop-light', 0);
    expect(one).toMatch(/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    expect(clientAddressFor('test-a', 'desktop-light', 0)).toBe(one);
    const others = [
      clientAddressFor('test-b', 'desktop-light', 0),
      clientAddressFor('test-a', 'phone-dark', 0),
      clientAddressFor('test-a', 'desktop-light', 1),
    ];
    for (const other of others) expect(other).not.toBe(one);
  });

  it('never gives a network or broadcast address', () => {
    for (let i = 0; i < 2000; i += 1) {
      const last = Number(clientAddressFor(`t${String(i)}`, 'p', 0).split('.')[3]);
      expect(last).toBeGreaterThanOrEqual(1);
      expect(last).toBeLessThanOrEqual(254);
    }
  });
});
