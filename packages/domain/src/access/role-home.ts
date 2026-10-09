import { STAFF_PAGES } from '@quad/contracts';

import { isPageVisible } from './page-access';

import type { PermissionKey, RoleScope, StaffPageId } from '@quad/contracts';

/**
 * The page a person starts on (spec 08: teachers start on My teaching, front desk on Attendance):
 * 1. My teaching, with `lms.create` and an `own_classes` primary role;
 * 2. else Dashboard, if visible;
 * 3. else Attendance, if visible;
 * 4. else the first visible page in side bar order (Communications at the latest, since every
 *    staff role has it).
 * `perms` comes from `effectivePermissions`, which has already dropped rows outside the plan.
 */
export function roleHome(
  perms: ReadonlySet<PermissionKey>,
  primaryRoleScope: RoleScope,
): StaffPageId {
  if (primaryRoleScope === 'own_classes' && perms.has('lms.create')) return 'my_teaching';
  const open = STAFF_PAGES.filter((page) => isPageVisible(page, perms)).map((page) => page.id);
  if (open.includes('dashboard')) return 'dashboard';
  if (open.includes('attendance')) return 'attendance';
  // The earliest open page. Communications needs nothing, so the default is never used.
  const [first = 'communications'] = open;
  return first;
}
