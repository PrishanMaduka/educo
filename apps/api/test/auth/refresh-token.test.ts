import { randomUUID } from 'node:crypto';

import { RefreshToken } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { bearerTokenOf } from '../../src/common/session/bearer';
import { RefreshTokens, isCurrentSecret } from '../../src/modules/auth/tokens/refresh-token';

const tokens = new RefreshTokens('test-session-secret-test-session-secret');
const sessionId = randomUUID();

describe('RefreshTokens (D32: {sessionId}.{generation}.{secret})', () => {
  it('issues a token the contract accepts and reads it back as issued', () => {
    const issued = tokens.issue(sessionId, 4);
    expect(RefreshToken.safeParse(issued.token).success).toBe(true);
    const read = tokens.read(issued.token);
    expect(read).toMatchObject({ sessionId, generation: 4, issued: true });
    expect(isCurrentSecret(issued.secretHash, read.secretHash)).toBe(true);
  });

  it('gives every token its own secret', () => {
    const first = tokens.issue(sessionId, 0);
    const second = tokens.issue(sessionId, 0);
    expect(first.token).not.toBe(second.token);
    expect(isCurrentSecret(first.secretHash, second.secretHash)).toBe(false);
  });

  it('does not count a secret moved to another family or generation as issued', () => {
    const secret = tokens.issue(sessionId, 2).token.split('.')[2];
    expect(tokens.read(`${sessionId}.3.${secret}`).issued).toBe(false);
    expect(tokens.read(`${randomUUID()}.2.${secret}`).issued).toBe(false);
  });

  it('does not count a token signed with another key, or a changed secret, as issued', () => {
    const other = new RefreshTokens('another-session-secret-another-secret');
    expect(tokens.read(other.issue(sessionId, 0).token).issued).toBe(false);
    const issued = tokens.issue(sessionId, 0).token;
    const flipped = `${issued.slice(0, -1)}${issued.endsWith('A') ? 'B' : 'A'}`;
    expect(tokens.read(flipped).issued).toBe(false);
  });

  it('counts only the canonical spelling of a secret', () => {
    // The last base64url character of 64 bytes carries 2 unused bits; another spelling decodes
    // to the same bytes but is not the token that was issued.
    const issued = tokens.issue(sessionId, 0).token;
    const last = issued.at(-1) ?? 'A';
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const twin = alphabet[alphabet.indexOf(last) ^ 1] ?? 'A';
    expect(tokens.read(`${issued.slice(0, -1)}${twin}`).issued).toBe(false);
  });

  it('never matches a family with no secret yet (still choosing a school)', () => {
    expect(isCurrentSecret(null, tokens.issue(sessionId, 0).secretHash)).toBe(false);
  });
});

describe('bearerTokenOf (spec 06: Authorization: Bearer)', () => {
  it('reads a compact JWS', () => {
    expect(bearerTokenOf('Bearer aaa.bbb.ccc')).toBe('aaa.bbb.ccc');
  });

  it('is undefined without an Authorization header, so the cookie is read', () => {
    expect(bearerTokenOf(undefined)).toBeUndefined();
  });

  it.each([
    'Bearer',
    'Bearer ',
    'bearer aaa.bbb.ccc',
    'Basic dXNlcjpwYXNz',
    'Bearer a.b',
    'Bearer a b.c.d',
  ])('refuses %j (null: never falls back to the cookie)', (header) => {
    expect(bearerTokenOf(header)).toBeNull();
  });

  it('refuses a repeated header', () => {
    expect(bearerTokenOf(['Bearer aaa.bbb.ccc', 'Bearer ddd.eee.fff'])).toBeNull();
  });
});
