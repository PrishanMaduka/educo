import { describe, expect, it } from 'vitest';

import { GeneralFormSchema, changesFrom, generalValuesOf } from './general-form';

import type { School } from '@quad/contracts';

const school = {
  name: 'Colombo International School',
  shortName: 'CIS',
  officeEmail: null,
  officePhone: '+94112345678',
  address: '12 Example Road',
  timeZone: 'Asia/Colombo',
  smsSenderId: null,
  smsSenderStatus: null,
  branding: { color: '#C8F169', logoUrl: null },
  signIn: { twoStep: 'admins', passwordMinLength: 12, sessionHours: 8, ipAllowlist: [] },
  summary: { parts: [], needs: [] },
  etag: '"v1"',
} satisfies School;

describe('generalValuesOf', () => {
  it('shows a missing value as an empty field', () => {
    expect(generalValuesOf(school)).toEqual({
      name: 'Colombo International School',
      officeEmail: '',
      officePhone: '+94112345678',
      address: '12 Example Road',
      smsSenderId: '',
    });
  });
});

describe('GeneralFormSchema (the contract’s own rules)', () => {
  const values = generalValuesOf(school);

  it.each([
    ['name', { ...values, name: '  ' }],
    ['officeEmail', { ...values, officeEmail: 'office' }],
    ['smsSenderId', { ...values, smsSenderId: 'NO' }],
  ])('refuses a bad %s at its field', (field, input) => {
    const result = GeneralFormSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it('accepts empty optional fields', () => {
    expect(
      GeneralFormSchema.safeParse({ ...values, officeEmail: '', smsSenderId: '' }).success,
    ).toBe(true);
  });
});

describe('changesFrom (only what changed, an emptied field cleared with null)', () => {
  it('sends the changed fields alone', () => {
    const parsed = GeneralFormSchema.parse({
      ...generalValuesOf(school),
      officeEmail: 'Office@Colombo-Intl.local',
      address: '',
    });
    expect(changesFrom(parsed, school)).toEqual({
      officeEmail: 'office@colombo-intl.local',
      address: null,
    });
  });

  it('sends nothing when nothing changed', () => {
    expect(changesFrom(GeneralFormSchema.parse(generalValuesOf(school)), school)).toEqual({});
  });
});
