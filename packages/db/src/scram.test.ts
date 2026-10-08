import { describe, expect, it } from 'vitest';

import { scramSha256Verifier } from './scram';

describe('scramSha256Verifier', () => {
  it('matches the verifier PostgreSQL 16 computed for the same password and salt', () => {
    // From `create role … password 'quad-vector-pw'` with password_encryption = scram-sha-256.
    const salt = Buffer.from('1RGjp5kMY07HBmVzLTeqSA==', 'base64');
    expect(scramSha256Verifier('quad-vector-pw', salt)).toBe(
      'SCRAM-SHA-256$4096:1RGjp5kMY07HBmVzLTeqSA==$' +
        'l547HwjAy9u1ZVgWdv6vZeA6A+i4j6qTS0PD20RvnI0=:EwNOd4u4H7+iad03sp995anWPOtBuXMrGyxFI4gmbG8=',
    );
  });

  it('uses a fresh 16-byte salt each time', () => {
    const first = scramSha256Verifier('same');
    const second = scramSha256Verifier('same');
    expect(first).not.toBe(second);
    const salt = /^SCRAM-SHA-256\$4096:([^$]+)\$/.exec(first)?.[1] ?? '';
    expect(Buffer.from(salt, 'base64')).toHaveLength(16);
  });

  it.each([['pässword'], ['密码'], ['']])('refuses %j, which needs SASLprep or is empty', (pw) => {
    expect(() => scramSha256Verifier(pw)).toThrow(/printable ASCII/);
  });
});
