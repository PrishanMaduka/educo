import { describe, expect, it } from 'vitest';

import { settingsSummary } from './settings-summary';

import type { SummaryProfile, SummarySettings } from './settings-summary';

const DEFAULTS: SummarySettings = {
  askQuadEnabled: true,
  quietHoursEnabled: true,
  quietFrom: '18:00',
  quietUntil: '07:00',
  quietWeekends: true,
};

const COMPLETE: SummaryProfile = {
  officeEmail: 'office@colombo-intl.local',
  smsSenderId: null,
  smsSenderStatus: null,
};

describe('settingsSummary (spec 08 School settings: the summary line)', () => {
  it('reads the spec example: "Ask Quad is on. Quiet hours are 18:00–07:00 and weekends."', () => {
    expect(settingsSummary(DEFAULTS, COMPLETE)).toEqual({
      parts: [
        { code: 'ask_quad_on' },
        { code: 'quiet_hours', from: '18:00', until: '07:00', weekends: true },
      ],
      needs: [],
    });
  });

  it('says when Ask Quad and quiet hours are off', () => {
    const off = { ...DEFAULTS, askQuadEnabled: false, quietHoursEnabled: false };
    expect(settingsSummary(off, COMPLETE).parts).toEqual([
      { code: 'ask_quad_off' },
      { code: 'quiet_hours_off' },
    ]);
  });

  it('gives school nights only when weekends are left out', () => {
    const weekdays = { ...DEFAULTS, quietFrom: '20:30', quietUntil: '06:00', quietWeekends: false };
    expect(settingsSummary(weekdays, COMPLETE).parts[1]).toEqual({
      code: 'quiet_hours',
      from: '20:30',
      until: '06:00',
      weekends: false,
    });
  });

  it.each([
    ['no office email', { ...COMPLETE, officeEmail: null }, [{ code: 'add_office_email' }]],
    [
      'a sender ID waiting for approval',
      { ...COMPLETE, smsSenderId: 'COLOMBOINTL', smsSenderStatus: 'requested' as const },
      [{ code: 'sms_sender_pending', senderId: 'COLOMBOINTL' }],
    ],
    [
      'an approved sender ID',
      { ...COMPLETE, smsSenderId: 'COLOMBOINTL', smsSenderStatus: 'approved' as const },
      [],
    ],
    [
      'both',
      { officeEmail: null, smsSenderId: 'CIS', smsSenderStatus: 'requested' as const },
      [{ code: 'add_office_email' }, { code: 'sms_sender_pending', senderId: 'CIS' }],
    ],
  ])('lists what needs doing: %s', (_name, profile, needs) => {
    expect(settingsSummary(DEFAULTS, profile).needs).toEqual(needs);
  });

  it('never lists a pending sender ID without the ID itself', () => {
    const odd = { ...COMPLETE, smsSenderStatus: 'requested' as const };
    expect(settingsSummary(DEFAULTS, odd).needs).toEqual([]);
  });

  it('leaves out online payments until M7', () => {
    const codes = settingsSummary(DEFAULTS, COMPLETE).parts.map((part) => part.code);
    expect(codes).not.toContain('online_payments');
  });
});
