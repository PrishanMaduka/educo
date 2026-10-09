import { describe, expect, it } from 'vitest';

import {
  MANAGED_BY_QUAD_FIELDS,
  School,
  SchoolBranding,
  SchoolSettings,
  SchoolUpdateInput,
  SettingsSummary,
  SmsSenderId,
} from '../index';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

const SUMMARY = {
  parts: [
    { code: 'ask_quad_on' },
    { code: 'quiet_hours', from: '18:00', until: '07:00', weekends: true },
  ],
  needs: [{ code: 'add_office_email' }],
};

describe('School (GET /school)', () => {
  const school = {
    name: 'Colombo International School',
    shortName: 'CIS',
    officeEmail: 'office@colombo-intl.local',
    officePhone: '+94112345678',
    address: '12 Example Road\nColombo 7',
    timeZone: 'Asia/Colombo',
    smsSenderId: 'COLOMBOINTL',
    smsSenderStatus: 'requested',
    branding: { color: '#C8F169', logoUrl: null },
    signIn: { twoStep: 'admins', passwordMinLength: 12, sessionHours: 8, ipAllowlist: [] },
    summary: SUMMARY,
    etag: '"abc"',
  };

  it('accepts a full profile', () => {
    expect(School.parse(school)).toEqual(school);
  });

  it('accepts a school with nothing optional set', () => {
    const bare = {
      ...school,
      officeEmail: null,
      officePhone: null,
      address: null,
      smsSenderId: null,
      smsSenderStatus: null,
    };
    expect(School.safeParse(bare).success).toBe(true);
  });

  it.each([
    ['branding', { ...school, branding: { color: 'lime', logoUrl: null } }, ['branding', 'color']],
    ['signIn', { ...school, signIn: { ...school.signIn, twoStep: 'sso' } }, ['signIn', 'twoStep']],
    [
      'summary',
      { ...school, summary: { parts: [{ code: 'payments' }], needs: [] } },
      ['summary', 'parts', 0, 'code'],
    ],
  ])('rejects a bad %s at its path', (_name, value, path) => {
    expect(pathOf(School.safeParse(value))).toEqual(path);
  });

  it('has no SSO fields in its sign-in rules (D37)', () => {
    expect(Object.keys(School.shape.signIn.shape).sort()).toEqual([
      'ipAllowlist',
      'passwordMinLength',
      'sessionHours',
      'twoStep',
    ]);
  });
});

describe('SchoolBranding (GET /school/branding)', () => {
  it('accepts a colour and no logo, and rejects a colour that is not hex', () => {
    expect(SchoolBranding.safeParse({ color: '#0F766E', logoUrl: null }).success).toBe(true);
    expect(pathOf(SchoolBranding.safeParse({ color: 'teal', logoUrl: null }))).toEqual(['color']);
  });
});

describe('SettingsSummary', () => {
  it('accepts each part and need', () => {
    expect(
      SettingsSummary.safeParse({
        parts: [{ code: 'ask_quad_off' }, { code: 'quiet_hours_off' }],
        needs: [{ code: 'sms_sender_pending', senderId: 'QUADSCHOOL' }],
      }).success,
    ).toBe(true);
  });

  it('rejects a quiet-hours time that is not HH:mm', () => {
    const value = {
      parts: [{ code: 'quiet_hours', from: '6pm', until: '07:00', weekends: true }],
      needs: [],
    };
    expect(pathOf(SettingsSummary.safeParse(value))).toEqual(['parts', 0, 'from']);
  });
});

describe('SmsSenderId (spec 08 General; D32: 3 to 11 letters and digits, at least one letter)', () => {
  it.each(['CIS', 'COLOMBOINTL', 'Quad2026', 'abc'])('accepts %s', (id) => {
    expect(SmsSenderId.safeParse(id).success).toBe(true);
  });

  it.each(['AB', 'COLOMBOINTL1', '12345', 'CIS SCHOOL', 'CIS-1', 'ÉCOLE'])('rejects %s', (id) => {
    expect(SmsSenderId.safeParse(id).success).toBe(false);
  });
});

describe('SchoolUpdateInput (PATCH /school)', () => {
  it('accepts any of the General fields, trimmed, and null to clear the optional ones', () => {
    expect(
      SchoolUpdateInput.parse({
        name: '  Colombo International School ',
        officeEmail: ' Office@Colombo-Intl.local ',
        officePhone: '011 234 5678',
        address: null,
        smsSenderId: 'COLOMBOINTL',
      }),
    ).toEqual({
      name: 'Colombo International School',
      officeEmail: 'office@colombo-intl.local',
      officePhone: '011 234 5678',
      address: null,
      smsSenderId: 'COLOMBOINTL',
    });
    expect(
      SchoolUpdateInput.safeParse({ officeEmail: null, officePhone: null, smsSenderId: null })
        .success,
    ).toBe(true);
  });

  it.each([
    ['a blank name', { name: '  ' }, ['name']],
    ['a null name', { name: null }, ['name']],
    ['a bad email', { officeEmail: 'office' }, ['officeEmail']],
    ['a long address', { address: 'x'.repeat(501) }, ['address']],
    ['a bad sender ID', { smsSenderId: 'NO' }, ['smsSenderId']],
    ['nothing to change', {}, []],
  ])('rejects %s at its path', (_name, value, path) => {
    expect(pathOf(SchoolUpdateInput.safeParse(value))).toEqual(path);
  });

  it.each(MANAGED_BY_QUAD_FIELDS)(
    'refuses %s: Managed by Quad, never silently ignored',
    (field) => {
      const result = SchoolUpdateInput.safeParse({ name: 'A School', [field]: 'anything' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/managed by Quad/);
    },
  );

  it('lists the time zone, branding and every sign-in rule as managed by Quad', () => {
    expect([...MANAGED_BY_QUAD_FIELDS].sort()).toEqual(
      [
        'branding',
        'brandColor',
        'color',
        'ipAllowlist',
        'logo',
        'logoUrl',
        'passwordMinLength',
        'sessionHours',
        'shortName',
        'signIn',
        'timeZone',
        'twoStep',
      ].sort(),
    );
  });

  it('refuses a field it does not know', () => {
    const result = SchoolUpdateInput.safeParse({ name: 'A School', colour: 'red' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/can’t be changed here/);
  });
});

describe('SchoolSettings (GET /settings)', () => {
  const settings = {
    askQuadEnabled: true,
    askQuadKeepConversations: true,
    ewShareWithParents: 'after_plan',
    absenceAlert: 'at_time',
    absenceAlertTime: '09:00',
    reminderDays: [-3, 7, 14],
    photoConsentDefault: 'class',
    familyCircleEnabled: true,
    quietHoursEnabled: true,
    quietFrom: '18:00',
    quietUntil: '07:00',
    quietWeekends: true,
    updatedAt: '2026-10-09T03:30:00.000Z',
  };

  it('accepts the defaults', () => {
    expect(SchoolSettings.parse(settings)).toEqual(settings);
  });

  it.each([
    ['ewShareWithParents', { ...settings, ewShareWithParents: 'always' }],
    ['absenceAlertTime', { ...settings, absenceAlertTime: '9am' }],
    ['reminderDays', { ...settings, reminderDays: [1.5] }],
  ])('rejects a bad %s', (field, value) => {
    expect(pathOf(SchoolSettings.safeParse(value))?.[0]).toBe(field);
  });
});
