import { describe, expect, it } from 'vitest';

import { OtpRequestInput, OtpVerifyInput, OtpVerifyResult, ParentMembership } from '../index';

const SCHOOL_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abc';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

describe('OtpRequestInput (spec 05, parent app step 2)', () => {
  it('takes a phone number as typed, trimmed (the API checks it against the country list)', () => {
    expect(OtpRequestInput.parse({ phone: ' +94 77 000 0001 ' })).toEqual({
      phone: '+94 77 000 0001',
    });
  });

  it('takes an email, trimmed and lower-cased ("Use email instead")', () => {
    expect(OtpRequestInput.parse({ email: ' Dilhani@Example.Test ' })).toEqual({
      email: 'dilhani@example.test',
    });
  });

  it.each([
    [{}, ['phone']],
    [{ phone: '+94 77 000 0001', email: 'dilhani@example.test' }, ['phone']],
    [{ phone: '' }, ['phone']],
    [{ phone: '+94 '.padEnd(40, '7') }, ['phone']],
    [{ email: 'not-an-email' }, ['email']],
    [{ phone: 770000001 }, ['phone']],
  ])('refuses %j at %j', (input, path) => {
    expect(pathOf(OtpRequestInput.safeParse(input))).toEqual(path);
  });

  it('refuses a school or any other field (the tenant is never an input)', () => {
    expect(
      pathOf(OtpRequestInput.safeParse({ phone: '+94770000001', tenantId: SCHOOL_ID })),
    ).toEqual([]);
  });
});

describe('OtpVerifyInput', () => {
  it('takes the subject and the 6-digit code', () => {
    expect(OtpVerifyInput.parse({ phone: '+94770000001', code: '123456' })).toEqual({
      phone: '+94770000001',
      code: '123456',
    });
    expect(OtpVerifyInput.parse({ email: 'A@Example.Test', code: '000000' })).toEqual({
      email: 'a@example.test',
      code: '000000',
    });
  });

  it.each([
    [{ phone: '+94770000001' }, ['code']],
    [{ phone: '+94770000001', code: '12345' }, ['code']],
    [{ phone: '+94770000001', code: '12345a' }, ['code']],
    [{ code: '123456' }, ['phone']],
    [{ phone: '+94770000001', email: 'a@example.test', code: '123456' }, ['phone']],
  ])('refuses %j at %j', (input, path) => {
    expect(pathOf(OtpVerifyInput.safeParse(input))).toEqual(path);
  });
});

describe('ParentMembership and OtpVerifyResult', () => {
  const membership = {
    tenantId: SCHOOL_ID,
    name: 'Colombo International School',
    shortName: 'CIS',
    logoUrl: null,
    brand: {
      color: '#1B7F53',
      light: {
        fill: '#1B7F53',
        fillStrong: '#176D47',
        ink: '#FFFFFF',
        text: '#19764D',
        soft: '#DBEBE3',
        railActive: '#1B7F53',
        railActiveInk: '#FFFFFF',
      },
      dark: {
        fill: '#1B7F53',
        fillStrong: '#176D47',
        ink: '#FFFFFF',
        text: '#5DA485',
        soft: '#183148',
        railActive: '#1B7F53',
        railActiveInk: '#FFFFFF',
      },
    },
    kind: 'guardian',
    suspended: false,
    suspendReason: null,
  } as const;

  it('lists guardian and relative memberships only', () => {
    expect(ParentMembership.parse(membership)).toEqual(membership);
    expect(ParentMembership.parse({ ...membership, kind: 'relative' }).kind).toBe('relative');
    expect(pathOf(ParentMembership.safeParse({ ...membership, kind: 'staff' }))).toEqual(['kind']);
  });

  it.each([
    {
      status: 'signed_in',
      firstName: 'Dilhani',
      memberships: [membership],
      accessToken: 'a.b.c',
      refreshToken: 'r',
    },
    { status: 'choose_school', memberships: [membership, membership], accessToken: 'a.b.c' },
    { status: 'not_found', memberships: [] },
  ])('accepts a $status answer', (result) => {
    expect(OtpVerifyResult.parse(result)).toEqual(result);
  });

  it('refuses another status', () => {
    expect(pathOf(OtpVerifyResult.safeParse({ status: 'done', memberships: [] }))).toEqual([
      'status',
    ]);
  });
});
