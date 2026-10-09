import { describe, expect, it } from 'vitest';

import { BearerClaims, RefreshInput, RefreshToken, TokenPair } from '../index';

const SESSION_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abc';
const OTHER_ID = '0192a6f4-1b2c-7d3e-8f40-cba987654321';
const SECRET = 'A'.repeat(86);

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

describe('RefreshToken (spec 05: {sessionId}.{generation}.{secret})', () => {
  it.each([`${SESSION_ID}.0.${SECRET}`, `${SESSION_ID}.17.${'a-_9'.repeat(21)}Zz`])(
    'accepts %s',
    (token) => {
      expect(RefreshToken.parse(token)).toBe(token);
    },
  );

  it.each([
    ['no generation', `${SESSION_ID}.${SECRET}`],
    ['a leading zero', `${SESSION_ID}.01.${SECRET}`],
    ['a negative generation', `${SESSION_ID}.-1.${SECRET}`],
    ['ten digits', `${SESSION_ID}.1234567890.${SECRET}`],
    ['a short secret', `${SESSION_ID}.0.${SECRET.slice(1)}`],
    ['padding', `${SESSION_ID}.0.${SECRET.slice(2)}==`],
    ['not a uuid', `session.0.${SECRET}`],
    ['upper-case hex', `${SESSION_ID.toUpperCase()}.0.${SECRET}`],
  ])('refuses %s', (_case, token) => {
    expect(RefreshToken.safeParse(token).success).toBe(false);
  });
});

describe('RefreshInput', () => {
  it('takes only the refresh token: no school can be named (a token never changes school)', () => {
    const refreshToken = `${SESSION_ID}.0.${SECRET}`;
    expect(RefreshInput.parse({ refreshToken })).toEqual({ refreshToken });
    expect(pathOf(RefreshInput.safeParse({ refreshToken, tenantId: OTHER_ID }))).toEqual([]);
    expect(pathOf(RefreshInput.safeParse({}))).toEqual(['refreshToken']);
  });
});

describe('TokenPair', () => {
  it('is an access token and a refresh token', () => {
    const pair = { accessToken: 'a.b.c', refreshToken: `${SESSION_ID}.1.${SECRET}` };
    expect(TokenPair.parse(pair)).toEqual(pair);
  });
});

describe('BearerClaims (the access JWT, spec 05)', () => {
  const registered = { iss: 'http://localhost:3000', aud: 'quad:parent', iat: 1, exp: 901 };
  const tenant = {
    ...registered,
    scope: 'tenant',
    sub: OTHER_ID,
    acc: SESSION_ID,
    tid: OTHER_ID,
    kind: 'guardian',
    rh: 'abcdefghijklmnopqrstuv',
    sid: SESSION_ID,
  } as const;

  it('reads a tenant token: the membership, account, school, kind, roles hash and family', () => {
    expect(BearerClaims.parse(tenant)).toEqual(tenant);
    expect(BearerClaims.parse({ ...tenant, kind: 'relative' }).scope).toBe('tenant');
  });

  it('reads a select_school token: the account and family only (OQ20)', () => {
    const selectSchool = {
      ...registered,
      scope: 'select_school',
      sub: SESSION_ID,
      acc: SESSION_ID,
      sid: OTHER_ID,
    };
    expect(BearerClaims.parse(selectSchool)).toEqual(selectSchool);
  });

  it.each([
    [{ ...tenant, kind: 'staff' }, ['kind']],
    [{ ...tenant, tid: 'school' }, ['tid']],
    [{ ...tenant, scope: 'admin' }, ['scope']],
    [{ ...tenant, sid: undefined }, ['sid']],
  ])('refuses %j at %j', (claims, path) => {
    expect(pathOf(BearerClaims.safeParse(claims))).toEqual(path);
  });
});
