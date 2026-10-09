import { PlanModule, STAFF_PAGES, StaffPageId } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { effectivePermissions } from './effective-permissions';
import { isPageVisible, pageAccess } from './page-access';
import { systemRoleMatrix } from './system-roles';

import type { PageAccess, PermissionKey, StaffPage, SystemRoleKey } from '@quad/contracts';

const EVERY_MODULE = PlanModule.options;

const permsOf = (key: SystemRoleKey, planModules: readonly PlanModule[] = EVERY_MODULE) =>
  effectivePermissions({ roles: [systemRoleMatrix(key)], planModules, adminSensitive: [] });

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
        ...full('attendance', 'pastoral', ...LEARNING),
      ],
    ],
    [
      'counsellor',
      full(
        'dashboard',
        'crm',
        'communications',
        'family_connection',
        'evenings_forms',
        'students',
        'early_warning',
        'pastoral',
      ),
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
