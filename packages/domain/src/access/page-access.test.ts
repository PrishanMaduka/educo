import { PlanModule, STAFF_PAGES, StaffPageId } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { effectivePermissions } from './effective-permissions';
import { isPageVisible, modulesRead, pageAccess } from './page-access';
import { systemRoleMatrix } from './system-roles';

import type { PageAccess, PermissionKey, StaffPage, SystemRoleKey } from '@quad/contracts';

const EVERY_MODULE = PlanModule.options;

const permsOf = (key: SystemRoleKey, planModules: readonly PlanModule[] = EVERY_MODULE) =>
  effectivePermissions({ roles: [systemRoleMatrix(key)], planModules });

/** The pages a role can open, in side bar order, with their access. */
function openPages(key: SystemRoleKey): [StaffPageId, PageAccess][] {
  return pageAccess(permsOf(key), EVERY_MODULE)
    .filter((p) => p.access !== 'hidden')
    .map((p) => [p.id, p.access]);
}

/** `pageAccess` as a lookup by page id. */
const accessMap = (perms: ReadonlySet<PermissionKey>, planModules: readonly PlanModule[]) =>
  new Map(pageAccess(perms, planModules).map((p) => [p.id, p.access]));

const page = (id: StaffPageId): StaffPage => {
  const found = STAFF_PAGES.find((p) => p.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('pageAccess (spec 08, Preview a role; OQ4)', () => {
  it('journey 50: finance sees exactly Dashboard, Communications, Students (View only), Fees and Accounting', () => {
    expect(openPages('finance')).toEqual([
      ['dashboard', 'full'],
      ['communications', 'full'],
      ['students', 'view_only'],
      ['fees', 'full'],
      ['accounting', 'full'],
    ]);
    expect(accessMap(permsOf('finance'), EVERY_MODULE).get('timetable')).toBe('hidden');
  });

  const LEARNING: StaffPageId[] = [
    'courses',
    'timetable',
    'teachers_classes',
    'staff_cover',
    'exams',
    'reports',
  ];
  const full = (...ids: StaffPageId[]): [StaffPageId, PageAccess][] =>
    ids.map((id) => [id, 'full']);

  it.each<[SystemRoleKey, [StaffPageId, PageAccess][]]>([
    ['admin', StaffPageId.options.map((id) => [id, 'full'])],
    [
      'principal',
      [
        ...full(
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
          ...LEARNING,
          'fees',
          'accounting',
          'routes',
          'pickup',
        ),
        ['academic_year', 'view_only'],
        ['school_settings', 'view_only'],
      ],
    ],
    [
      'admissions',
      [
        ...full(
          'dashboard',
          'admissions',
          'crm',
          'communications',
          'family_connection',
          'evenings_forms',
        ),
        ['students', 'view_only'],
      ],
    ],
    [
      'teacher',
      [
        ...full('my_teaching', 'communications'),
        ['students', 'view_only'],
        ...full('attendance', 'pastoral', 'courses'),
        // Timetable, staffing and cover are run by approvers (fullWhen lms.approve).
        ['timetable', 'view_only'],
        ['teachers_classes', 'view_only'],
        ['staff_cover', 'view_only'],
        ...full('exams', 'reports'),
      ],
    ],
    [
      'counsellor',
      [
        ['communications', 'full'],
        // sis view and create, no edit: Students is View only (fullWhen sis.edit).
        ['students', 'view_only'],
        ['early_warning', 'full'],
        ['attendance', 'view_only'],
        ['pastoral', 'full'],
      ],
    ],
    [
      'frontdesk',
      [
        ['communications', 'full'],
        ['students', 'view_only'],
        ['attendance', 'full'],
        ['routes', 'view_only'],
        ['pickup', 'view_only'],
      ],
    ],
  ])('%s opens these pages', (key, expected) => {
    expect(openPages(key)).toEqual(expected);
  });

  it('hides a page whose plan module the school lacks, even with the permission', () => {
    const perms = new Set<PermissionKey>(['transport.view', 'transport.create', 'lms.create']);
    const access = accessMap(perms, ['lms']);
    expect(access.get('routes')).toBe('hidden');
    expect(access.get('my_teaching')).toBe('full');
  });

  /** `pageAccess`'s reason for each hidden page, by page id (D52). */
  const hiddenByMap = (perms: ReadonlySet<PermissionKey>, planModules: readonly PlanModule[]) =>
    new Map(pageAccess(perms, planModules).map((p) => [p.id, p.hiddenBy]));

  it('says a page is hidden by the plan when its module is outside the plan (D52)', () => {
    const reasons = hiddenByMap(permsOf('admin', ['sis']), ['sis']);
    expect(reasons.get('fees')).toBe('plan');
    expect(reasons.get('routes')).toBe('plan');
    expect(reasons.get('courses')).toBe('plan');
    expect(reasons.get('students')).toBeUndefined();
  });

  it('says plan, not role, when the page is outside both (D52)', () => {
    const reasons = hiddenByMap(permsOf('teacher', ['sis', 'lms']), ['sis', 'lms']);
    expect(reasons.get('fees')).toBe('plan');
    expect(reasons.get('admissions')).toBe('plan');
  });

  it('says role when the plan includes the page but the role does not open it (D52)', () => {
    const reasons = hiddenByMap(permsOf('teacher'), EVERY_MODULE);
    expect(reasons.get('fees')).toBe('role');
    expect(reasons.get('school_settings')).toBe('role');
    expect(reasons.get('courses')).toBeUndefined();
  });

  it('says plan for a page with no plan module of its own when every row it reads is outside the plan (D52)', () => {
    // Pastoral reads sis.create or lms.create, and has no single plan module.
    expect(hiddenByMap(permsOf('admin', ['fees']), ['fees']).get('pastoral')).toBe('plan');
    expect(hiddenByMap(permsOf('finance', ['sis']), ['sis']).get('pastoral')).toBe('role');
    // Dashboard reads settings.view among others, and Settings is in every plan.
    expect(hiddenByMap(new Set(), []).get('dashboard')).toBe('role');
    expect(hiddenByMap(new Set(), []).get('users_roles')).toBe('role');
  });

  it('gives every hidden page a reason and no open page one (D52)', () => {
    for (const planModules of [EVERY_MODULE, ['sis'] as const, [] as const]) {
      for (const entry of pageAccess(permsOf('frontdesk', planModules), planModules)) {
        expect(entry.hiddenBy === undefined).toBe(entry.access !== 'hidden');
      }
    }
  });

  it('shows Communications to every staff role, with no permissions at all', () => {
    const access = accessMap(new Set(), []);
    expect(StaffPageId.options.filter((id) => access.get(id) !== 'hidden')).toEqual([
      'communications',
    ]);
    expect(access.get('communications')).toBe('full');
  });

  it('is View only when the row has view and nothing else', () => {
    expect(accessMap(new Set(['fees.view']), EVERY_MODULE).get('fees')).toBe('view_only');
    expect(accessMap(new Set(['fees.view', 'fees.approve']), EVERY_MODULE).get('fees')).toBe(
      'full',
    );
    expect(accessMap(new Set(['fees.view', 'fees.delete']), EVERY_MODULE).get('fees')).toBe('full');
  });

  it('with fullWhen, is full only with one of its keys', () => {
    const lms = (...keys: PermissionKey[]) =>
      accessMap(new Set<PermissionKey>(['lms.view', ...keys]), EVERY_MODULE).get('timetable');
    expect(lms()).toBe('view_only');
    expect(lms('lms.create', 'lms.edit', 'lms.delete')).toBe('view_only');
    expect(lms('lms.approve')).toBe('full');
  });

  it('never makes an any-of page View only', () => {
    expect(accessMap(new Set(['settings.view']), EVERY_MODULE).get('dashboard')).toBe('full');
  });

  it('has an entry for every page, in side bar order, frozen', () => {
    const access = pageAccess(new Set(), []);
    expect(access.map((p) => p.id)).toEqual(StaffPageId.options);
    expect(Object.isFrozen(access)).toBe(true);
    for (const entry of access) expect(Object.isFrozen(entry)).toBe(true);
  });
});

describe('isPageVisible', () => {
  it.each<[StaffPageId, PermissionKey[], boolean]>([
    ['communications', [], true],
    ['students', ['sis.view'], true],
    ['students', ['sis.create'], false],
    ['pastoral', ['lms.create'], true],
    ['pastoral', ['sis.create'], true],
    ['pastoral', ['sis.view', 'lms.view'], false],
    ['users_roles', ['settings.edit'], false],
    ['users_roles', ['users.manage'], true],
  ])('%s with %j: %s (permissions only; the plan is pageAccess’s job)', (id, keys, visible) => {
    expect(isPageVisible(page(id), new Set(keys))).toBe(visible);
  });
});

describe('modulesRead (D52)', () => {
  it.each<[StaffPageId, string[]]>([
    ['communications', []],
    ['fees', ['fees']],
    ['pastoral', ['sis', 'lms']],
    ['dashboard', ['admissions', 'crm', 'fees', 'finance', 'settings']],
    ['users_roles', ['settings']],
  ])('%s reads %j', (id, rows) => {
    expect(modulesRead(page(id))).toEqual(rows);
  });
});
