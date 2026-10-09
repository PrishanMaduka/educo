import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  MATRIX_PERMISSION_KEYS,
  PERMISSION_MODULE_PLAN,
  PermissionAction,
  PermissionKey,
  PermissionModule,
  SENSITIVE_PERMISSION_KEYS,
  SystemRoleKey,
  matrixPermissionKey,
  sensitivePermissionKey,
} from './index';

import type { MatrixPermissionKey, SensitivePermissionKey, SensitiveKey } from './index';

describe('PermissionKey (spec 05, Permission matrix)', () => {
  it('has every <module>.<action> of the 9 × 5 matrix, in matrix order', () => {
    const expected = PermissionModule.options.flatMap((module) =>
      PermissionAction.options.map((action) => `${module}.${action}`),
    );
    expect(MATRIX_PERMISSION_KEYS).toEqual(expected);
    expect(MATRIX_PERMISSION_KEYS).toHaveLength(45);
  });

  it('has a sensitive.<key> for each of the four sensitive keys', () => {
    expect(SENSITIVE_PERMISSION_KEYS).toEqual([
      'sensitive.safeguarding',
      'sensitive.medical',
      'sensitive.finance_reports',
      'sensitive.export_data',
    ]);
  });

  it('is the matrix keys, the sensitive keys and users.manage (OQ3), nothing else', () => {
    expect(PermissionKey.options).toEqual([
      ...MATRIX_PERMISSION_KEYS,
      ...SENSITIVE_PERMISSION_KEYS,
      'users.manage',
    ]);
    expect(new Set(PermissionKey.options).size).toBe(50);
  });

  it('parses a known key and refuses an unknown one', () => {
    expect(PermissionKey.parse('fees.approve')).toBe('fees.approve');
    expect(PermissionKey.safeParse('fees.refund').success).toBe(false);
    expect(PermissionKey.safeParse('sensitive.salary').success).toBe(false);
  });

  it('builds keys from their parts with the right types', () => {
    expect(matrixPermissionKey('sis', 'view')).toBe('sis.view');
    expect(sensitivePermissionKey('medical')).toBe('sensitive.medical');
    expectTypeOf(matrixPermissionKey('sis', 'view')).toEqualTypeOf<MatrixPermissionKey>();
    expectTypeOf<MatrixPermissionKey>().toEqualTypeOf<`${PermissionModule}.${PermissionAction}`>();
    expectTypeOf<SensitivePermissionKey>().toEqualTypeOf<`sensitive.${SensitiveKey}`>();
    expectTypeOf<
      MatrixPermissionKey | SensitivePermissionKey | 'users.manage'
    >().toEqualTypeOf<PermissionKey>();
  });
});

describe('SystemRoleKey (spec 05, School roles)', () => {
  it('lists the seven system roles in spec order', () => {
    expect(SystemRoleKey.options).toEqual([
      'admin',
      'principal',
      'finance',
      'admissions',
      'teacher',
      'counsellor',
      'frontdesk',
    ]);
  });
});

describe('PERMISSION_MODULE_PLAN', () => {
  it('maps each matrix row to the plan module that switches it on', () => {
    expect(PERMISSION_MODULE_PLAN).toEqual({
      admissions: 'admissions',
      crm: 'crm',
      sis: 'sis',
      attendance: 'sis',
      lms: 'lms',
      fees: 'fees',
      finance: 'finance',
      transport: 'transport',
      settings: null,
    });
    expect(Object.isFrozen(PERMISSION_MODULE_PLAN)).toBe(true);
  });
});
