import { describe, expect, it } from 'vitest';

import {
  AccountStatus,
  MembershipKind,
  MembershipStatus,
  OtpChannel,
  PlanModule,
  PlatformRole,
  RoleScope,
  SchoolHealthLevel,
  SensitiveKey,
  SessionKind,
  SessionStage,
  SsoProvider,
  TenantRegion,
  TenantStatus,
  TwoStepRule,
} from './index';

describe('tenant enums (spec 04, Platform)', () => {
  it('lists the regions in spec order', () => {
    expect(TenantRegion.options).toEqual(['ap-south', 'me-central', 'ap-southeast']);
  });

  it('lists the school statuses in spec order', () => {
    expect(TenantStatus.options).toEqual([
      'trial',
      'onboarding',
      'active',
      'past_due',
      'suspended',
      'deleted',
    ]);
  });

  it('lists the health levels in spec order and rejects others', () => {
    expect(SchoolHealthLevel.options).toEqual(['thriving', 'watch', 'at_risk', 'paused']);
    expect(SchoolHealthLevel.safeParse('great').success).toBe(false);
  });
});

describe('identity and access enums (spec 04 Platform and Identity, spec 05)', () => {
  it.each([
    ['AccountStatus', AccountStatus, ['active', 'locked', 'disabled']],
    ['SsoProvider', SsoProvider, ['google', 'microsoft']],
    ['SessionKind', SessionKind, ['web', 'mobile', 'console']],
    ['SessionStage', SessionStage, ['two_step', 'two_step_setup', 'choose_school', 'active']],
    ['OtpChannel', OtpChannel, ['sms', 'email']],
    ['PlatformRole', PlatformRole, ['owner', 'admin', 'support', 'billing', 'readonly']],
    ['TwoStepRule', TwoStepRule, ['off', 'admins', 'staff', 'all']],
    [
      'PlanModule',
      PlanModule,
      ['admissions', 'crm', 'sis', 'lms', 'fees', 'finance', 'parent', 'transport'],
    ],
    ['MembershipKind', MembershipKind, ['staff', 'guardian', 'relative']],
    ['MembershipStatus', MembershipStatus, ['invited', 'active', 'deactivated']],
    ['RoleScope', RoleScope, ['school', 'campus', 'own_classes']],
    ['SensitiveKey', SensitiveKey, ['safeguarding', 'medical', 'finance_reports', 'export_data']],
  ])('%s lists its values in spec order', (_name, schema, values) => {
    expect(schema.options).toEqual(values);
  });

  it('rejects a value outside the enum', () => {
    expect(SessionStage.safeParse('signed_in').success).toBe(false);
  });
});
