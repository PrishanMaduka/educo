import { STAFF_PAGES } from '@quad/contracts';

import type {
  PageAccess,
  PermissionKey,
  PlanModule,
  StaffPage,
  StaffPageAccess,
} from '@quad/contracts';

/** The actions besides View; holding any of them on a page's row makes the page more than View only. */
const WRITE_ACTIONS = ['create', 'edit', 'delete', 'approve'] as const;

/**
 * Whether the permissions meet a page's `requires` (OQ4). Permissions only: the school's plan is
 * checked by `pageAccess`, and `effectivePermissions` has already dropped rows outside the plan.
 */
export function isPageVisible(page: StaffPage, perms: ReadonlySet<PermissionKey>): boolean {
  const { requires } = page;
  switch (requires.kind) {
    case 'everyone':
      return true;
    case 'view':
      return perms.has(`${requires.module}.view`);
    case 'any_of':
      return requires.keys.some((key) => perms.has(key));
  }
}

function accessOf(
  page: StaffPage,
  perms: ReadonlySet<PermissionKey>,
  planModules: readonly PlanModule[],
): PageAccess {
  const inPlan = page.planModule === undefined || planModules.includes(page.planModule);
  if (!inPlan || !isPageVisible(page, perms)) return 'hidden';
  if (page.requires.kind !== 'view') return 'full';
  const { module } = page.requires;
  return WRITE_ACTIONS.some((action) => perms.has(`${module}.${action}`)) ? 'full' : 'view_only';
}

/**
 * How much of each staff page the permissions open (spec 08, Preview a role; OQ4): `hidden` when
 * the page's plan module is not in the plan or its `requires` is not met; `view_only` for a
 * `view` page when the row has View but no create, edit, delete or approve; otherwise `full`.
 * Returns every page in side bar order, frozen.
 */
export function pageAccess(
  perms: ReadonlySet<PermissionKey>,
  planModules: readonly PlanModule[],
): readonly StaffPageAccess[] {
  return Object.freeze(
    STAFF_PAGES.map((page) =>
      Object.freeze({ id: page.id, access: accessOf(page, perms, planModules) }),
    ),
  );
}
