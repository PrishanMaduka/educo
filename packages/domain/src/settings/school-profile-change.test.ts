import { describe, expect, it } from 'vitest';

import { planSchoolProfileChange } from './school-profile-change';

import type { SchoolProfileValues } from './school-profile-change';

const CURRENT: SchoolProfileValues = {
  name: 'Colombo International School',
  officeEmail: 'office@colombo-intl.local',
  officePhone: '+94112345678',
  address: '12 Example Road',
  smsSenderId: null,
  smsSenderStatus: null,
};

describe('planSchoolProfileChange (spec 08 General)', () => {
  it('changes only the fields that differ, with their before and after', () => {
    const plan = planSchoolProfileChange(CURRENT, {
      name: 'Colombo International School',
      officeEmail: 'admin@colombo-intl.local',
      address: null,
    });
    expect(plan.next).toEqual({
      ...CURRENT,
      officeEmail: 'admin@colombo-intl.local',
      address: null,
    });
    expect(plan.changes).toEqual({
      officeEmail: { from: 'office@colombo-intl.local', to: 'admin@colombo-intl.local' },
      address: { from: '12 Example Road', to: null },
    });
    expect(plan.fields).toEqual(['officeEmail', 'address']);
  });

  it('changes nothing when every value is the same', () => {
    const plan = planSchoolProfileChange(CURRENT, { officePhone: '+94112345678' });
    expect(plan).toEqual({ next: CURRENT, changes: {}, fields: [] });
  });

  it('asks Quad for a new sender ID: it is requested until approved ("QUAD" meanwhile)', () => {
    const plan = planSchoolProfileChange(CURRENT, { smsSenderId: 'COLOMBOINTL' });
    expect(plan.next).toMatchObject({ smsSenderId: 'COLOMBOINTL', smsSenderStatus: 'requested' });
    expect(plan.changes).toEqual({
      smsSenderId: { from: null, to: 'COLOMBOINTL' },
      smsSenderStatus: { from: null, to: 'requested' },
    });
  });

  it('asks again when an approved sender ID is replaced', () => {
    const approved = { ...CURRENT, smsSenderId: 'CIS', smsSenderStatus: 'approved' as const };
    const plan = planSchoolProfileChange(approved, { smsSenderId: 'COLOMBOINTL' });
    expect(plan.next.smsSenderStatus).toBe('requested');
  });

  it('keeps an approved sender ID approved when it is sent again unchanged', () => {
    const approved = { ...CURRENT, smsSenderId: 'CIS', smsSenderStatus: 'approved' as const };
    expect(planSchoolProfileChange(approved, { smsSenderId: 'CIS' })).toEqual({
      next: approved,
      changes: {},
      fields: [],
    });
  });

  it('withdraws the sender ID with null: texts go as "QUAD" and there is nothing to approve', () => {
    const requested = { ...CURRENT, smsSenderId: 'CIS', smsSenderStatus: 'requested' as const };
    const plan = planSchoolProfileChange(requested, { smsSenderId: null });
    expect(plan.next).toMatchObject({ smsSenderId: null, smsSenderStatus: null });
    expect(plan.fields).toEqual(['smsSenderId', 'smsSenderStatus']);
  });

  it('never changes the input it was given', () => {
    const current = Object.freeze({ ...CURRENT });
    const input = Object.freeze({ name: 'New name' });
    planSchoolProfileChange(current, input);
    expect(current).toEqual(CURRENT);
    expect(input).toEqual({ name: 'New name' });
  });
});
