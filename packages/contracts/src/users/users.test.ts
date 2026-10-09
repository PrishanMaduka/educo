import { describe, expect, it } from 'vitest';

import {
  AuditAction,
  ErrorCode,
  PasswordSignInInput,
  TotpSetupInput,
  TotpVerifyInput,
  InviteAcceptInput,
  InviteDetails,
  InviteTokenParams,
  StaffInviteInput,
  StaffList,
  StaffListQuery,
  StaffUpdateInput,
} from '../index';

const ROLE_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abd';
const USER_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abe';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

describe('the Users & roles error codes (spec 06, 08)', () => {
  it.each(['last_admin', 'system_role_locked', 'already_member'])('include %s', (code) => {
    expect(ErrorCode.safeParse(code).success).toBe(true);
  });
});

describe('StaffListQuery (GET /users)', () => {
  it('takes the filters, the search and a page', () => {
    const parsed = StaffListQuery.parse({
      status: 'invited',
      roleId: ROLE_ID,
      q: ' Nadee ',
      limit: '20',
    });
    expect(parsed).toEqual({ status: 'invited', roleId: ROLE_ID, q: 'Nadee', limit: 20 });
  });

  it.each([
    [{ status: 'gone' }, ['status']],
    [{ roleId: 'x' }, ['roleId']],
    [{ q: '' }, ['q']],
    [{ limit: '500' }, ['limit']],
  ])('refuses %j at its path', (query, path) => {
    expect(pathOf(StaffListQuery.safeParse(query))).toEqual(path);
  });
});

describe('StaffList', () => {
  const member = {
    id: USER_ID,
    name: 'Nadeesha Jayasinghe',
    email: 'nadeesha@colombo-intl.local',
    status: 'active',
    role: { id: ROLE_ID, name: 'Teacher' },
    twoStepOn: false,
    lastSignInAt: '2026-10-08T08:05:00.000Z',
    inviteSentAt: null,
  };

  it('is a page of members with the story summary', () => {
    const list = { items: [member], nextCursor: null, summary: { staff: 14, withoutTwoStep: 3 } };
    expect(StaffList.safeParse(list).success).toBe(true);
  });

  it('refuses an unknown status at its path', () => {
    const list = {
      items: [{ ...member, status: 'gone' }],
      nextCursor: null,
      summary: { staff: 1, withoutTwoStep: 0 },
    };
    expect(pathOf(StaffList.safeParse(list))).toEqual(['items', 0, 'status']);
  });
});

describe('StaffInviteInput (POST /users/invite)', () => {
  it('takes 1 to 50 addresses, trimmed and lower-cased, and a role', () => {
    const parsed = StaffInviteInput.parse({ emails: [' Amaya@School.Example '], roleId: ROLE_ID });
    expect(parsed.emails).toEqual(['amaya@school.example']);
  });

  it.each([
    [{ emails: [] }, ['emails']],
    [{ emails: Array.from({ length: 51 }, (_, i) => `p${i}@school.example`) }, ['emails']],
    [{ emails: ['not-an-address'] }, ['emails', 0]],
    [{ emails: ['a@school.example', 'A@school.example'] }, ['emails', 1]],
    [{ roleId: 'x' }, ['roleId']],
    [{ extra: true }, []],
  ])('refuses %j at its path', (change, path) => {
    const input = { emails: ['a@school.example'], roleId: ROLE_ID, ...change };
    expect(pathOf(StaffInviteInput.safeParse(input))).toEqual(path);
  });
});

describe('StaffUpdateInput (PATCH /users/:id)', () => {
  it('takes a role, a status, or both', () => {
    expect(StaffUpdateInput.safeParse({ roleId: ROLE_ID }).success).toBe(true);
    expect(StaffUpdateInput.safeParse({ status: 'deactivated' }).success).toBe(true);
    expect(StaffUpdateInput.safeParse({ roleId: ROLE_ID, status: 'active' }).success).toBe(true);
  });

  it.each([
    [{}, []],
    [{ status: 'invited' }, ['status']],
    [{ roleId: 'x' }, ['roleId']],
    [{ name: 'Someone' }, []],
  ])('refuses %j at its path', (input, path) => {
    expect(pathOf(StaffUpdateInput.safeParse(input))).toEqual(path);
  });
});

describe('the staff invite link (GET /auth/invites/:token, POST …/accept)', () => {
  it('shows the school, the name, a masked address and whether a password is needed', () => {
    const details = {
      school: 'Colombo International School',
      name: 'Amaya',
      emailMasked: 'a•••@school.example',
      needsPassword: true,
    };
    expect(InviteDetails.safeParse(details).success).toBe(true);
  });

  it('takes a token of at most 2048 characters', () => {
    expect(InviteTokenParams.safeParse({ token: 'a.b' }).success).toBe(true);
    expect(pathOf(InviteTokenParams.safeParse({ token: 'a'.repeat(2049) }))).toEqual(['token']);
  });

  it('accepts with a password, or without one for an existing account', () => {
    expect(InviteAcceptInput.safeParse({ password: 'a long passphrase' }).success).toBe(true);
    expect(InviteAcceptInput.safeParse({}).success).toBe(true);
    expect(pathOf(InviteAcceptInput.safeParse({ password: '' }))).toEqual(['password']);
    expect(pathOf(InviteAcceptInput.safeParse({ password: 'x'.repeat(1025) }))).toEqual([
      'password',
    ]);
    expect(pathOf(InviteAcceptInput.safeParse({ email: 'a@b.example' }))).toEqual([]);
  });
});

describe('fix round 1 additions', () => {
  it('has own_role_locked and the user.invite_accepted audit action', () => {
    expect(ErrorCode.safeParse('own_role_locked').success).toBe(true);
    expect(AuditAction.safeParse('user.invite_accepted').success).toBe(true);
  });

  it('shows the invitee name only when the school set one (M7)', () => {
    const details = {
      school: 'Colombo International School',
      emailMasked: 'a•••@school.example',
      needsPassword: true,
    };
    expect(InviteDetails.safeParse(details).success).toBe(true);
  });

  it.each([
    ['PasswordSignInInput', PasswordSignInInput, { email: 'a@school.example', password: 'x' }],
    ['TotpVerifyInput', TotpVerifyInput, { code: '000000' }],
    ['TotpSetupInput', TotpSetupInput, { code: '000000' }],
  ] as const)('%s takes an optional invite token as a hint (I4)', (_name, schema, input) => {
    expect(schema.safeParse({ ...input, inviteToken: 'a.b' }).success).toBe(true);
    expect(schema.safeParse(input).success).toBe(true);
    expect(pathOf(schema.safeParse({ ...input, inviteToken: 'a'.repeat(2049) }))).toEqual([
      'inviteToken',
    ]);
  });
});
