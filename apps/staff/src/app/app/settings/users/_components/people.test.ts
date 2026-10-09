import { describe, expect, it } from 'vitest';

import { rowActionsFor, splitEmails } from './people';

import type { StaffMember } from '@quad/contracts';

const member = (change: Partial<StaffMember>): StaffMember => ({
  id: '0190a000-0000-7000-8000-0000000000d1',
  name: 'Amaya Perera',
  email: 'amaya.perera@colombo-intl.local',
  status: 'active',
  role: null,
  twoStepOn: true,
  lastSignInAt: null,
  inviteSentAt: null,
  you: false,
  ...change,
});

describe('rowActionsFor (spec 08 row actions; never "Sign in as")', () => {
  it.each([
    ['active', true, ['reset_password', 'sign_out_everywhere', 'deactivate']],
    ['active', false, ['remind_two_step', 'reset_password', 'sign_out_everywhere', 'deactivate']],
    ['invited', false, ['resend_invite', 'deactivate']],
    ['deactivated', false, ['reactivate']],
  ] as const)('a %s member with two-step %s gets %j', (status, twoStepOn, actions) => {
    expect(rowActionsFor(member({ status, twoStepOn }))).toEqual(actions);
  });

  it('gives your own row nothing: nobody deactivates or resets themselves here', () => {
    expect(rowActionsFor(member({ you: true, twoStepOn: false }))).toEqual([]);
  });

  it('leaves out the emailing actions for a member without an address', () => {
    expect(rowActionsFor(member({ email: null, twoStepOn: false }))).toEqual([
      'sign_out_everywhere',
      'deactivate',
    ]);
  });
});

describe('splitEmails (the invite drawer)', () => {
  it('splits on commas, semicolons, spaces and new lines, dropping blanks', () => {
    expect(splitEmails(' a@x.lk, b@x.lk;\nc@x.lk  d@x.lk ,, ')).toEqual([
      'a@x.lk',
      'b@x.lk',
      'c@x.lk',
      'd@x.lk',
    ]);
    expect(splitEmails('   ')).toEqual([]);
  });
});
