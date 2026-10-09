import { z } from 'zod';

import type { PermissionModule, PlanModule } from '../enums';
import type { PermissionKey } from '../permissions';

/**
 * The staff portal's pages and who may open them (spec 08, Navigation; OQ4 in D32). Data only:
 * `pageAccess` and `roleHome` in `@quad/domain` decide, and the API sends the result in
 * `GET /me/permissions`. Labels and icons live with the apps (copy in `en.json`).
 */

/** A side bar group, in spec 08 order. */
export const StaffNavGroup = z.enum([
  'overview',
  'pre_admission',
  'relationships',
  'student_information',
  'learning',
  'finance',
  'transport',
  'settings',
]);
export type StaffNavGroup = z.infer<typeof StaffNavGroup>;

/** A staff portal page, in side bar order. */
export const StaffPageId = z.enum([
  'dashboard',
  'my_teaching',
  'admissions',
  'crm',
  'communications',
  'family_connection',
  'evenings_forms',
  'students',
  'early_warning',
  'attendance',
  'pastoral',
  'courses',
  'timetable',
  'teachers_classes',
  'staff_cover',
  'exams',
  'reports',
  'fees',
  'accounting',
  'routes',
  'pickup',
  'academic_year',
  'users_roles',
  'school_settings',
]);
export type StaffPageId = z.infer<typeof StaffPageId>;

/**
 * How much of a page a person gets: `hidden` (not in the menu; opening it shows "{Page} isn't
 * part of the {role} role"), `view_only` (the **View only** tag, no action buttons) or `full`.
 */
export const PageAccess = z.enum(['hidden', 'view_only', 'full']);
export type PageAccess = z.infer<typeof PageAccess>;

/** One page and how much of it a person gets (`GET /me/permissions` `pages`, side bar order). */
export const StaffPageAccess = z.object({ id: StaffPageId, access: PageAccess });
export type StaffPageAccess = z.infer<typeof StaffPageAccess>;

/**
 * When a page is visible:
 * - `everyone`: every staff role;
 * - `view`: `<module>.view`; the page is View only unless the person also has another action on
 *   that row;
 * - `any_of`: any one of the keys; such a page is never View only.
 */
export type PagePredicate =
  | { readonly kind: 'everyone' }
  | { readonly kind: 'view'; readonly module: PermissionModule }
  | { readonly kind: 'any_of'; readonly keys: readonly PermissionKey[] };

export interface StaffPage {
  readonly id: StaffPageId;
  readonly group: StaffNavGroup;
  readonly href: string;
  readonly requires: PagePredicate;
  /**
   * The plan module the page belongs to; the page is hidden when the school's plan lacks it.
   * Set only when every matrix row `requires` reads belongs to that plan module, so a check on
   * plan-filtered permissions and this check always agree.
   */
  readonly planModule?: PlanModule;
}

const EVERYONE: PagePredicate = Object.freeze({ kind: 'everyone' });
const view = (module: PermissionModule): PagePredicate => Object.freeze({ kind: 'view', module });
const anyOf = (...keys: PermissionKey[]): PagePredicate =>
  Object.freeze({ kind: 'any_of', keys: Object.freeze(keys) });

const LEARNING = view('lms');

/** Every staff page in side bar order (spec 08), with the OQ4 visibility rule. */
export const STAFF_PAGES: readonly StaffPage[] = Object.freeze(
  (
    [
      {
        id: 'dashboard',
        group: 'overview',
        href: '/app',
        requires: anyOf(
          'admissions.view',
          'crm.view',
          'fees.view',
          'finance.view',
          'settings.view',
        ),
      },
      {
        id: 'my_teaching',
        group: 'overview',
        href: '/app/teaching',
        requires: anyOf('lms.create'),
        planModule: 'lms',
      },
      {
        id: 'admissions',
        group: 'pre_admission',
        href: '/app/admissions',
        requires: view('admissions'),
        planModule: 'admissions',
      },
      {
        id: 'crm',
        group: 'relationships',
        href: '/app/crm',
        requires: view('crm'),
        planModule: 'crm',
      },
      {
        id: 'communications',
        group: 'relationships',
        href: '/app/messages',
        requires: EVERYONE,
      },
      {
        id: 'family_connection',
        group: 'relationships',
        href: '/app/family-connection',
        requires: view('crm'),
        planModule: 'crm',
      },
      {
        id: 'evenings_forms',
        group: 'relationships',
        href: '/app/evenings',
        requires: view('crm'),
        planModule: 'crm',
      },
      {
        id: 'students',
        group: 'student_information',
        href: '/app/students',
        requires: view('sis'),
        planModule: 'sis',
      },
      {
        id: 'early_warning',
        group: 'student_information',
        href: '/app/early-warning',
        requires: anyOf('sis.create'),
        planModule: 'sis',
      },
      {
        id: 'attendance',
        group: 'student_information',
        href: '/app/attendance',
        requires: view('attendance'),
        planModule: 'sis',
      },
      {
        id: 'pastoral',
        group: 'student_information',
        href: '/app/pastoral',
        requires: anyOf('sis.create', 'lms.create'),
      },
      {
        id: 'courses',
        group: 'learning',
        href: '/app/courses',
        requires: LEARNING,
        planModule: 'lms',
      },
      {
        id: 'timetable',
        group: 'learning',
        href: '/app/timetable',
        requires: LEARNING,
        planModule: 'lms',
      },
      {
        id: 'teachers_classes',
        group: 'learning',
        href: '/app/staffing',
        requires: LEARNING,
        planModule: 'lms',
      },
      {
        id: 'staff_cover',
        group: 'learning',
        href: '/app/cover',
        requires: LEARNING,
        planModule: 'lms',
      },
      { id: 'exams', group: 'learning', href: '/app/exams', requires: LEARNING, planModule: 'lms' },
      {
        id: 'reports',
        group: 'learning',
        href: '/app/reports',
        requires: LEARNING,
        planModule: 'lms',
      },
      {
        id: 'fees',
        group: 'finance',
        href: '/app/fees',
        requires: view('fees'),
        planModule: 'fees',
      },
      {
        id: 'accounting',
        group: 'finance',
        href: '/app/accounting',
        requires: view('finance'),
        planModule: 'finance',
      },
      {
        id: 'routes',
        group: 'transport',
        href: '/app/transport/routes',
        requires: view('transport'),
        planModule: 'transport',
      },
      {
        id: 'pickup',
        group: 'transport',
        href: '/app/transport/pickup',
        requires: view('transport'),
        planModule: 'transport',
      },
      {
        id: 'academic_year',
        group: 'settings',
        href: '/app/settings/academic-year',
        requires: view('settings'),
      },
      {
        id: 'users_roles',
        group: 'settings',
        href: '/app/settings/users',
        requires: anyOf('users.manage'),
      },
      {
        id: 'school_settings',
        group: 'settings',
        href: '/app/settings/school',
        requires: view('settings'),
      },
    ] satisfies StaffPage[]
  ).map((page) => Object.freeze(page)),
);
