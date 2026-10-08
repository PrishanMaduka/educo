import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { SIGNED_LINK_RULES, signedLinkExpiry, signedLinkStatus } from './signed-link-status';

import type { SignedLinkPayload, SignedLinkPurpose } from '@quad/contracts';

const TENANT = '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e5f';
const SUBJECT = '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e60';
const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA';
/** 2026-10-08T09:00:00Z. */
const NOW = new Date('2026-10-08T09:00:00Z');
const NOW_SECONDS = NOW.getTime() / 1000;

const MINUTE = 60;
const DAY = 24 * 60 * MINUTE;

const PURPOSES: readonly SignedLinkPurpose[] = [
  'password_reset',
  'staff_invite',
  'guardian_invite',
  'relative_invite',
  'support_session',
  'calendar_feed',
  'email_link',
];

function payload(overrides: Partial<SignedLinkPayload> = {}): SignedLinkPayload {
  return {
    purpose: 'staff_invite',
    tid: TENANT,
    sub: SUBJECT,
    exp: NOW_SECONDS + 7 * DAY,
    nonce: NONCE,
    ...overrides,
  };
}

/** A payload for `purpose` issued at `issuedAt`, as `signLink` builds it. */
function issued(purpose: SignedLinkPurpose, issuedAt: Date = NOW): SignedLinkPayload {
  return payload({ purpose, exp: signedLinkExpiry(purpose, issuedAt) });
}

describe('SIGNED_LINK_RULES', () => {
  it.each<[SignedLinkPurpose, number | null, boolean]>([
    ['password_reset', 30 * MINUTE, true],
    ['staff_invite', 7 * DAY, true],
    ['guardian_invite', 30 * DAY, true],
    ['relative_invite', 30 * DAY, true],
    ['support_session', 2 * MINUTE, true],
    ['calendar_feed', null, false],
    ['email_link', 30 * DAY, false],
  ])('%s lives %s seconds, single use %s', (purpose, ttlSeconds, singleUse) => {
    expect(SIGNED_LINK_RULES[purpose]).toEqual({ ttlSeconds, singleUse });
  });

  it('has a rule for every purpose and nothing else', () => {
    expect(Object.keys(SIGNED_LINK_RULES).sort()).toEqual([...PURPOSES].sort());
  });
});

describe('signedLinkExpiry', () => {
  it('adds the purpose lifetime to now, in Unix seconds', () => {
    expect(signedLinkExpiry('password_reset', NOW)).toBe(NOW_SECONDS + 30 * MINUTE);
  });

  it('rounds a fractional now down to the second before adding the lifetime', () => {
    expect(signedLinkExpiry('support_session', new Date(NOW.getTime() + 999))).toBe(
      NOW_SECONDS + 2 * MINUTE,
    );
  });

  it('is null for a purpose with no expiry', () => {
    expect(signedLinkExpiry('calendar_feed', NOW)).toBeNull();
  });
});

describe('signedLinkStatus', () => {
  describe.each(PURPOSES)('%s', (purpose) => {
    const ttlSeconds = SIGNED_LINK_RULES[purpose].ttlSeconds;

    it('is ok when just issued', () => {
      expect(signedLinkStatus(issued(purpose), purpose, NOW)).toBe('ok');
    });

    if (ttlSeconds === null) {
      it('never expires', () => {
        const later = new Date(NOW.getTime() + 3650 * DAY * 1000);
        expect(signedLinkStatus(issued(purpose), purpose, later)).toBe('ok');
      });
    } else {
      it('is ok one millisecond before the expiry instant', () => {
        const justBefore = new Date((NOW_SECONDS + ttlSeconds) * 1000 - 1);
        expect(signedLinkStatus(issued(purpose), purpose, justBefore)).toBe('ok');
      });

      it('is expired at the exact expiry instant (exp == now)', () => {
        const atExpiry = new Date((NOW_SECONDS + ttlSeconds) * 1000);
        expect(signedLinkStatus(issued(purpose), purpose, atExpiry)).toBe('expired');
      });

      it('is expired after the expiry instant', () => {
        const after = new Date((NOW_SECONDS + ttlSeconds + 1) * 1000);
        expect(signedLinkStatus(issued(purpose), purpose, after)).toBe('expired');
      });
    }

    it('is wrong_purpose when checked for any other purpose', () => {
      for (const other of PURPOSES.filter((p) => p !== purpose)) {
        expect(signedLinkStatus(issued(purpose), other, NOW)).toBe('wrong_purpose');
      }
    });
  });

  it.each<[string, Partial<SignedLinkPayload>]>([
    ['a school-less staff invite', { purpose: 'staff_invite', tid: null }],
    ['a school-less support session', { purpose: 'support_session', tid: null }],
    ['a school-less calendar feed', { purpose: 'calendar_feed', tid: null, exp: null }],
    ['a staff invite that never expires', { purpose: 'staff_invite', exp: null }],
    ['a password reset that never expires', { purpose: 'password_reset', tid: null, exp: null }],
    ['a calendar feed with an expiry', { purpose: 'calendar_feed', exp: NOW_SECONDS + DAY }],
  ])('is malformed for %s', (_name, overrides) => {
    const malformed = payload(overrides);
    expect(signedLinkStatus(malformed, malformed.purpose, NOW)).toBe('malformed');
  });

  it('accepts an account-level password reset with no school (OQ8)', () => {
    const reset = payload({ purpose: 'password_reset', tid: null, exp: NOW_SECONDS + MINUTE });
    expect(signedLinkStatus(reset, 'password_reset', NOW)).toBe('ok');
  });

  it('checks the purpose before anything else', () => {
    const expiredInvite = payload({ purpose: 'staff_invite', exp: NOW_SECONDS - 1 });
    expect(signedLinkStatus(expiredInvite, 'password_reset', NOW)).toBe('wrong_purpose');
  });

  it('never verifies a payload under a different purpose (property)', () => {
    const purpose = fc.constantFrom(...PURPOSES);
    fc.assert(
      fc.property(
        purpose,
        purpose,
        fc.option(fc.uuid(), { nil: null }),
        fc.option(fc.integer({ min: 1, max: 2 ** 40 }), { nil: null }),
        fc.integer({ min: 0, max: 2 ** 40 * 1000 }),
        (signedFor, checkedFor, tid, exp, nowMs) => {
          fc.pre(signedFor !== checkedFor);
          const link = payload({ purpose: signedFor, tid, exp });
          expect(signedLinkStatus(link, checkedFor, new Date(nowMs))).not.toBe('ok');
        },
      ),
    );
  });
});
