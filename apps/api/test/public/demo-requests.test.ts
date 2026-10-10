import { createHmac, hkdfSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { demoRequestEmailsFor } from '../../src/public/demo-requests/demo-request-emails';
import { normalisedEmail } from '../../src/public/demo-requests/demo-requests.controller';
import { leadIpHasher } from '../../src/public/demo-requests/lead-ip-hash';

const SECRET = 'test-session-secret-test-session-secret';
const LEAD_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abd';

describe('normalisedEmail (the per-email rate-limit subject)', () => {
  it('makes A@x.com, a@x.com and padded spellings one subject', () => {
    const subjects = ['A@x.com', 'a@x.com', '  a@X.COM ', 'A@X.Com'].map((email) =>
      normalisedEmail({ email }),
    );
    expect(new Set(subjects)).toEqual(new Set(['a@x.com']));
  });

  it('folds compatibility spellings (full-width letters) into the plain one', () => {
    expect(normalisedEmail({ email: 'Ａ@x.com' })).toBe('a@x.com');
  });

  it.each([undefined, null, 'a@x.com', {}, { email: 42 }])(
    'skips the rule for a body without a text email (%j)',
    (body) => {
      expect(normalisedEmail(body)).toBeUndefined();
    },
  );
});

describe('demoRequestEmailsFor', () => {
  it('sends the sales email and the confirmation for a new lead', () => {
    expect(demoRequestEmailsFor(LEAD_ID, true)).toEqual([
      { jobId: `demo-request.${LEAD_ID}.sales`, kind: 'sales' },
      { jobId: `demo-request.${LEAD_ID}.confirm`, kind: 'confirm' },
    ]);
  });

  it('sends only the sales email for a repeat, so the requester gets one confirmation', () => {
    expect(demoRequestEmailsFor(LEAD_ID, false)).toEqual([
      { jobId: `demo-request.${LEAD_ID}.sales`, kind: 'sales' },
    ]);
  });
});

describe('leadIpHasher', () => {
  const hash = leadIpHasher(SECRET);

  it('is HMAC-SHA256 of the address under HKDF(SESSION_SECRET, "quad lead ip"), 32 bytes', () => {
    const key = Buffer.from(hkdfSync('sha256', SECRET, '', 'quad lead ip', 32));
    const expected = createHmac('sha256', key).update('203.0.113.7', 'utf8').digest();
    expect(hash('203.0.113.7')).toHaveLength(32);
    expect(hash('203.0.113.7').equals(expected)).toBe(true);
  });

  it('gives one address one hash, and another address or secret another', () => {
    expect(hash('203.0.113.7').equals(hash('203.0.113.7'))).toBe(true);
    expect(hash('203.0.113.7').equals(hash('203.0.113.8'))).toBe(false);
    expect(hash('203.0.113.7').equals(leadIpHasher(`${SECRET}x`)('203.0.113.7'))).toBe(false);
  });

  it('never equals the rate-limit subject hash of the same address (its own HKDF info)', () => {
    const rateLimitKey = Buffer.from(hkdfSync('sha256', SECRET, '', 'quad rate-limit subject', 32));
    const rateLimitHash = createHmac('sha256', rateLimitKey).update('203.0.113.7').digest();
    expect(hash('203.0.113.7').equals(rateLimitHash)).toBe(false);
  });
});
