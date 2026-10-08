import { describe, expect, it } from 'vitest';

import {
  AbsenceAlertMode,
  AccountStatus,
  EarlyWarningSharing,
  MembershipKind,
  MembershipStatus,
  OtpChannel,
  PermissionAction,
  PermissionModule,
  PhotoConsent,
  PlanModule,
  PlatformRole,
  RoleScope,
  SchoolHealthLevel,
  SensitiveKey,
  SessionKind,
  SessionStage,
  SmsSenderStatus,
  SsoProvider,
  TenantRegion,
  TenantStatus,
  ThemeChoice,
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

describe('membership, permission matrix and school settings enums (spec 04, 05, 08, 12)', () => {
  it.each([
    ['ThemeChoice', ThemeChoice, ['system', 'light', 'dark']],
    [
      'PermissionModule',
      PermissionModule,
      ['admissions', 'crm', 'sis', 'attendance', 'lms', 'fees', 'finance', 'transport', 'settings'],
    ],
    ['PermissionAction', PermissionAction, ['view', 'create', 'edit', 'delete', 'approve']],
    ['EarlyWarningSharing', EarlyWarningSharing, ['off', 'after_plan', 'automatic']],
    ['AbsenceAlertMode', AbsenceAlertMode, ['at_time', 'immediately']],
    ['PhotoConsent', PhotoConsent, ['class', 'family', 'none']],
    ['SmsSenderStatus', SmsSenderStatus, ['requested', 'approved']],
  ])('%s lists its values in spec order', (_name, schema, values) => {
    expect(schema.options).toEqual(values);
  });

  it('keeps the permission matrix modules apart from the plan modules (spec 05 vs spec 04)', () => {
    expect(PermissionModule.safeParse('parent').success).toBe(false);
    expect(PlanModule.safeParse('settings').success).toBe(false);
  });
});
