import { describe, expect, it } from 'vitest';

import { SignedLinkPayloadSchema, SignedLinkPurpose } from './signed-link';

const valid = {
  purpose: 'staff_invite',
  tid: '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e5f',
  sub: '0192f0c4-7a3b-7c2d-8e9f-0a1b2c3d4e60',
  exp: 1_791_000_000,
  nonce: 'AAAAAAAAAAAAAAAAAAAAAA',
};

describe('SignedLinkPurpose', () => {
  it('lists the seven purposes of spec 05', () => {
    expect(SignedLinkPurpose.options).toEqual([
      'password_reset',
      'staff_invite',
      'guardian_invite',
      'relative_invite',
      'support_session',
      'calendar_feed',
      'email_link',
    ]);
  });
});

describe('SignedLinkPayloadSchema', () => {
  it('accepts a complete payload', () => {
    expect(SignedLinkPayloadSchema.parse(valid)).toEqual(valid);
  });

  it('accepts a null tid and a null exp (the domain rules decide which purposes allow them)', () => {
    expect(SignedLinkPayloadSchema.safeParse({ ...valid, tid: null, exp: null }).success).toBe(
      true,
    );
  });

  it.each<[string, Record<string, unknown>]>([
    ['purpose', { purpose: 'magic_link' }],
    ['tid', { tid: 'school-a' }],
    ['sub', { sub: 'someone@example.com' }],
    ['sub', { sub: null }],
    ['exp', { exp: 1.5 }],
    ['exp', { exp: '1791000000' }],
    ['exp', { exp: 0 }],
    ['nonce', { nonce: 'short' }],
    ['nonce', { nonce: 'AAAAAAAAAAAAAAAAAAAAA+' }],
  ])('rejects a bad %s', (path, change) => {
    const result = SignedLinkPayloadSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([path]);
  });

  it.each(['purpose', 'tid', 'sub', 'exp', 'nonce'])('rejects a payload without %s', (key) => {
    const payload = Object.fromEntries(Object.entries(valid).filter(([k]) => k !== key));
    expect(SignedLinkPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects unknown keys, so nothing else can ride along in a signed payload', () => {
    const result = SignedLinkPayloadSchema.safeParse({ ...valid, role: 'admin' });
    expect(result.success).toBe(false);
  });
});
