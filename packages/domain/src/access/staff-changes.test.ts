import { describe, expect, it } from 'vitest';

import { staffActionRefusal, staffChangeRefusal, statusAfterChange } from './staff-changes';

import type { StaffChange } from './staff-changes';

const ADMIN = { id: 'target', status: 'active', isAdmin: true } as const;
const TEACHER = { id: 'target', status: 'active', isAdmin: false } as const;

function change(overrides: Partial<StaffChange>): StaffChange {
  return {
    actorUserId: 'actor',
    target: TEACHER,
    nextIsAdmin: TEACHER.isAdmin,
    roleChanges: false,
    nextStatus: TEACHER.status,
    otherActiveAdmins: 1,
    ...overrides,
  };
}

describe('staffChangeRefusal (spec 08 Users & roles; the last admin, self-protection)', () => {
  it('allows a role change and a deactivation of someone else', () => {
    expect(staffChangeRefusal(change({ roleChanges: true }))).toBeNull();
    expect(staffChangeRefusal(change({ nextStatus: 'deactivated' }))).toBeNull();
  });

  it('refuses changing your own role or deactivating yourself', () => {
    const self = { target: { ...TEACHER, id: 'actor' } };
    expect(staffChangeRefusal(change({ ...self, roleChanges: true }))).toBe('self');
    expect(staffChangeRefusal(change({ ...self, nextStatus: 'deactivated' }))).toBe('self');
  });

  it('lets a support visit (no member) change anyone', () => {
    expect(staffChangeRefusal(change({ actorUserId: null, roleChanges: true }))).toBeNull();
  });

  it.each([
    ['demoting', { nextIsAdmin: false, roleChanges: true }],
    ['deactivating', { nextStatus: 'deactivated' as const }],
  ])('refuses %s the last active admin', (_label, overrides) => {
    const last = change({ target: ADMIN, nextIsAdmin: true, otherActiveAdmins: 0, ...overrides });
    expect(staffChangeRefusal(last)).toBe('last_admin');
  });

  it('allows demoting an admin while another active admin remains', () => {
    const demote = change({ target: ADMIN, nextIsAdmin: false, roleChanges: true });
    expect(staffChangeRefusal(demote)).toBeNull();
  });

  it('allows keeping the last admin an admin (a no-op role change)', () => {
    const same = change({
      target: ADMIN,
      nextIsAdmin: true,
      roleChanges: true,
      otherActiveAdmins: 0,
    });
    expect(staffChangeRefusal(same)).toBeNull();
  });

  it('does not count an invited or deactivated admin as the last admin', () => {
    const invited = { ...ADMIN, status: 'invited' as const };
    expect(
      staffChangeRefusal(
        change({
          target: invited,
          nextIsAdmin: false,
          roleChanges: true,
          nextStatus: 'invited',
          otherActiveAdmins: 0,
        }),
      ),
    ).toBeNull();
  });

  it.each([
    ['active', 'deactivated', null],
    ['deactivated', 'active', null],
    ['invited', 'deactivated', null],
    ['invited', 'active', 'status_not_allowed'],
  ] as const)('a member %s may become %s: %s', (from, to, expected) => {
    const target = { ...TEACHER, status: from };
    expect(staffChangeRefusal(change({ target, nextStatus: to }))).toBe(expected);
  });
});

describe('staffActionRefusal (Remind, Reset password, Resend invite)', () => {
  it.each([
    ['remind_two_step', 'active', false, null],
    ['remind_two_step', 'active', true, 'two_step_on'],
    ['remind_two_step', 'invited', false, 'not_active'],
    ['remind_two_step', 'deactivated', false, 'not_active'],
    ['reset_password', 'active', false, null],
    ['reset_password', 'invited', false, 'not_active'],
    ['reset_password', 'deactivated', false, 'not_active'],
    ['resend_invite', 'invited', false, null],
    ['resend_invite', 'active', false, 'not_invited'],
    ['resend_invite', 'deactivated', false, 'not_invited'],
  ] as const)('%s for a member %s (two-step %s): %s', (action, status, twoStepOn, expected) => {
    expect(staffActionRefusal(action, { status, twoStepOn })).toBe(expected);
  });
});

describe('statusAfterChange (fix round 1, I1: an invite is never activated without being accepted)', () => {
  it.each([
    ['active', 'deactivated', true, 'deactivated'],
    ['invited', 'deactivated', false, 'deactivated'],
    ['deactivated', 'active', true, 'active'],
    // Invited, then deactivated before accepting: reactivating puts the invitation back.
    ['deactivated', 'active', false, 'invited'],
    ['active', 'active', true, 'active'],
    ['invited', 'invited', false, 'invited'],
  ] as const)(
    '%s asked to be %s (accepted %s) is stored as %s',
    (current, requested, accepted, stored) => {
      expect(statusAfterChange({ current, requested, accepted })).toBe(stored);
    },
  );

  it('lets a never-accepted member go back to invited through staffChangeRefusal', () => {
    const target = { id: 'target', status: 'deactivated', isAdmin: false } as const;
    expect(staffChangeRefusal(change({ target, nextStatus: 'invited' }))).toBeNull();
  });
});
