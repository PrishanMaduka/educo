import { PermissionModule, STAFF_PAGES } from '@quad/contracts';

import { modulesOutsidePlan } from './matrix-plan';

import type {
  PageAccess,
  PageHiddenBy,
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
  if (page.fullWhen) return page.fullWhen.some((key) => perms.has(key)) ? 'full' : 'view_only';
  if (page.requires.kind !== 'view') return 'full';
  const { module } = page.requires;
  return WRITE_ACTIONS.some((action) => perms.has(`${module}.${action}`)) ? 'full' : 'view_only';
}

/** The matrix rows a page's `requires` reads; `users.manage` comes from `settings.edit` (OQ3). */
export function modulesRead(page: StaffPage): readonly PermissionModule[] {
  const { requires } = page;
  switch (requires.kind) {
    case 'everyone':
      return [];
    case 'view':
      return [requires.module];
    case 'any_of':
      return requires.keys.map((key) => {
        const row = PermissionModule.safeParse(key.split('.')[0]);
        return row.success ? row.data : 'settings';
      });
  }
}

/**
 * Whether the school's plan leaves the page out (D52): its plan module is not in the plan, or
 * every matrix row its `requires` reads is outside the plan (`modulesOutsidePlan`), so no role
 * could open it there.
 */
function outsidePlan(
  page: StaffPage,
  planModules: readonly PlanModule[],
  rowsOutside: ReadonlySet<PermissionModule>,
): boolean {
  if (page.planModule !== undefined && !planModules.includes(page.planModule)) return true;
  const rows = modulesRead(page);
  return rows.length > 0 && rows.every((row) => rowsOutside.has(row));
}

/**
 * How much of each staff page the permissions open (spec 08, Preview a role; OQ4): `hidden` when
 * the page's plan module is not in the plan or its `requires` is not met; for a page with
 * `fullWhen`, `full` only with one of those keys; for a `view` page, `view_only` when the row has
 * View but no create, edit, delete or approve; otherwise `full`. A hidden page says why
 * (`hiddenBy`, D52): `plan` when the plan leaves it out, even if the role doesn't open it either,
 * and `role` otherwise.
 * Returns every page in side bar order, frozen.
 */
export function pageAccess(
  perms: ReadonlySet<PermissionKey>,
  planModules: readonly PlanModule[],
): readonly StaffPageAccess[] {
  const rowsOutside = new Set(modulesOutsidePlan(planModules));
  return Object.freeze(
    STAFF_PAGES.map((page) => {
      const access = accessOf(page, perms, planModules);
      if (access !== 'hidden') return Object.freeze({ id: page.id, access });
      const hiddenBy: PageHiddenBy = outsidePlan(page, planModules, rowsOutside) ? 'plan' : 'role';
      return Object.freeze({ id: page.id, access, hiddenBy });
    }),
  );
}
