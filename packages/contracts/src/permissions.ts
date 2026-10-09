import { z } from 'zod';

import type { PermissionAction, PermissionModule, PlanModule, SensitiveKey } from './enums';

/**
 * The permission catalogue (spec 05, Permission matrix). One key per matrix cell
 * (`<module>.<action>`), one per sensitive key (`sensitive.<key>`), and `users.manage`, which no
 * matrix cell holds: a role has it when it has `settings.edit` (OQ3, D32). The API guards routes
 * with these keys (`@Can('fees.create')`), and the apps read them from `GET /me/permissions`.
 * Later milestones append their own keys here (for example `circle.connection.read`).
 */

/** A matrix cell's key, `<PermissionModule>.<PermissionAction>`. */
export type MatrixPermissionKey = `${PermissionModule}.${PermissionAction}`;

/** A sensitive key's permission key, `sensitive.<SensitiveKey>`. */
export type SensitivePermissionKey = `sensitive.${SensitiveKey}`;

/** Every matrix key, in matrix order: rows as `PermissionModule`, columns as `PermissionAction`. */
export const MATRIX_PERMISSION_KEYS = Object.freeze([
  'admissions.view',
  'admissions.create',
  'admissions.edit',
  'admissions.delete',
  'admissions.approve',
  'crm.view',
  'crm.create',
  'crm.edit',
  'crm.delete',
  'crm.approve',
  'sis.view',
  'sis.create',
  'sis.edit',
  'sis.delete',
  'sis.approve',
  'attendance.view',
  'attendance.create',
  'attendance.edit',
  'attendance.delete',
  'attendance.approve',
  'lms.view',
  'lms.create',
  'lms.edit',
  'lms.delete',
  'lms.approve',
  'fees.view',
  'fees.create',
  'fees.edit',
  'fees.delete',
  'fees.approve',
  'finance.view',
  'finance.create',
  'finance.edit',
  'finance.delete',
  'finance.approve',
  'transport.view',
  'transport.create',
  'transport.edit',
  'transport.delete',
  'transport.approve',
  'settings.view',
  'settings.create',
  'settings.edit',
  'settings.delete',
  'settings.approve',
] as const satisfies readonly MatrixPermissionKey[]);

/** Every sensitive permission key, in `SensitiveKey` order (off by default, every use logged). */
export const SENSITIVE_PERMISSION_KEYS = Object.freeze([
  'sensitive.safeguarding',
  'sensitive.medical',
  'sensitive.finance_reports',
  'sensitive.export_data',
] as const satisfies readonly SensitivePermissionKey[]);

/** The key for managing staff accounts, roles and role previews (specs 06 and 08; OQ3). */
export const USERS_MANAGE = 'users.manage';

export const PermissionKey = z.enum([
  ...MATRIX_PERMISSION_KEYS,
  ...SENSITIVE_PERMISSION_KEYS,
  USERS_MANAGE,
]);
export type PermissionKey = z.infer<typeof PermissionKey>;

/** The key of one matrix cell, for example `matrixPermissionKey('sis', 'view')` is `sis.view`. */
export function matrixPermissionKey(
  module: PermissionModule,
  action: PermissionAction,
): MatrixPermissionKey {
  return `${module}.${action}`;
}

/** The permission key of a sensitive key, for example `sensitive.medical`. */
export function sensitivePermissionKey(key: SensitiveKey): SensitivePermissionKey {
  return `sensitive.${key}`;
}

/** The seven system roles every school has (spec 05, School roles); their matrices are fixed. */
export const SystemRoleKey = z.enum([
  'admin',
  'principal',
  'finance',
  'admissions',
  'teacher',
  'counsellor',
  'frontdesk',
]);
export type SystemRoleKey = z.infer<typeof SystemRoleKey>;

/**
 * The plan module that switches each matrix row on (spec 05, Plan and module guard). A row whose
 * plan module the school lacks is shown "Not in plan" and grants nothing. Attendance has no plan
 * module of its own and comes with student records (`sis`); `settings` is in every plan (D32).
 */
export const PERMISSION_MODULE_PLAN: Readonly<Record<PermissionModule, PlanModule | null>> =
  Object.freeze({
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
