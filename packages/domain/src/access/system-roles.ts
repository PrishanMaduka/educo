import { rowOf } from './matrix';

import type { PermissionRow, RoleGrant } from './matrix';
import type { PermissionModule, RoleScope, SensitiveKey, SystemRoleKey } from '@quad/contracts';

/** A system role's fixed defaults: a row for every module, its sensitive keys and its scope. */
export interface SystemRoleDefaults extends RoleGrant {
  readonly matrix: Readonly<Record<PermissionModule, PermissionRow>>;
  readonly sensitive: readonly SensitiveKey[];
  readonly scope: RoleScope;
}

/** A matrix written as `bit(5)` text per module; modules left out are no access. */
type MatrixBits = Partial<Record<PermissionModule, string>>;

function defaults(
  bits: MatrixBits,
  sensitive: readonly SensitiveKey[] = [],
  scope: RoleScope = 'school',
): SystemRoleDefaults {
  const row = (module: PermissionModule): PermissionRow => rowOf(bits[module] ?? '00000');
  const matrix: Record<PermissionModule, PermissionRow> = {
    admissions: row('admissions'),
    crm: row('crm'),
    sis: row('sis'),
    attendance: row('attendance'),
    lms: row('lms'),
    fees: row('fees'),
    finance: row('finance'),
    transport: row('transport'),
    settings: row('settings'),
  };
  return Object.freeze({
    matrix: Object.freeze(matrix),
    sensitive: Object.freeze([...sensitive]),
    scope,
  });
}

const ALL = '11111';
const VIEW = '10000';
/** View, create and edit: the prototype's working set for a role's own modules. */
const WORK = '11100';
/** Everything but delete: the prototype's principal row. */
const LEAD = '11101';

/**
 * The defaults of the seven system roles (spec 05, School roles). Where spec 05 is silent the
 * prototype's `rolePerms` (`design/admin.html`) fills in (OQ5); where they differ, spec 05 wins.
 * The prototype has no transport row, so transport follows each role's spec 05 line. Sensitive
 * keys are off by default (spec 05), except:
 * - `admin` holds all four: support is "the admin matrix minus safeguarding and medical", and a
 *   school admin can grant only the keys they hold (spec 08), so someone must hold them;
 * - `counsellor` holds `medical` ("pastoral and medical"; safeguarding only when granted).
 */
const SYSTEM_ROLES: Readonly<Record<SystemRoleKey, SystemRoleDefaults>> = Object.freeze({
  // Everything in enabled modules; users and roles; school settings.
  admin: defaults(
    {
      admissions: ALL,
      crm: ALL,
      sis: ALL,
      attendance: ALL,
      lms: ALL,
      fees: ALL,
      finance: ALL,
      transport: ALL,
      settings: ALL,
    },
    ['safeguarding', 'medical', 'finance_reports', 'export_data'],
  ),
  // Everything except school settings (read only, so no users.manage); approves reports and offers.
  principal: defaults({
    admissions: LEAD,
    crm: LEAD,
    sis: LEAD,
    attendance: LEAD,
    lms: LEAD,
    fees: LEAD,
    finance: LEAD,
    transport: LEAD,
    settings: VIEW,
  }),
  // Fees, finance, read students.
  finance: defaults({ sis: VIEW, fees: ALL, finance: ALL }),
  // Admissions, CRM, read students (the spec adds sis.view to the prototype).
  admissions: defaults({ admissions: WORK, crm: WORK, sis: VIEW }),
  // Own classes: registers, gradebook, reports, moments, behaviour; reads students.
  teacher: defaults({ sis: VIEW, attendance: WORK, lms: WORK }, [], 'own_classes'),
  // Pastoral and medical; safeguarding only when granted. Follows the prototype's preview, not its
  // rolePerms: no CRM; sis view and create (pastoral notes, early warning), so Students is View
  // only (it needs sis.edit to be full); reads attendance.
  counsellor: defaults({ sis: '11000', attendance: VIEW }, ['medical']),
  // Attendance (late arrivals, so writes too), the pickup page, read contact details.
  frontdesk: defaults({ sis: VIEW, attendance: WORK, transport: VIEW }),
});

/**
 * The fixed defaults of a system role. System roles cannot be changed (spec 05), so the result is
 * frozen and the same object on every call.
 */
export function systemRoleMatrix(key: SystemRoleKey): SystemRoleDefaults {
  return SYSTEM_ROLES[key];
}
