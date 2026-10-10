import { describe, expect, it } from 'vitest';

import {
  PERMISSION_MODULE_PLAN,
  PageAccess,
  PermissionKey,
  PermissionModule,
  STAFF_PAGES,
  StaffNavGroup,
  StaffPageAccess,
  StaffPageId,
} from '../index';

import type { PagePredicate, StaffPage } from '../index';

const byId = (id: StaffPageId): StaffPage => {
  const page = STAFF_PAGES.find((p) => p.id === id);
  if (!page) throw new Error(`no page ${id}`);
  return page;
};

/** The matrix rows a predicate reads. */
function modulesOf(requires: PagePredicate): readonly PermissionModule[] {
  switch (requires.kind) {
    case 'everyone':
      return [];
    case 'view':
      return [requires.module];
    case 'any_of':
      // `users.manage` comes from `settings.edit` (OQ3).
      return requires.keys.map((key) =>
        key === 'users.manage' ? 'settings' : PermissionModule.parse(key.split('.')[0]),
      );
  }
}

describe('STAFF_PAGES (spec 08, Navigation; OQ4)', () => {
  it('lists the side bar in spec 08 order, grouped', () => {
    expect(STAFF_PAGES.map((p) => [p.group, p.id])).toEqual([
      ['overview', 'dashboard'],
      ['overview', 'my_teaching'],
      ['pre_admission', 'admissions'],
      ['relationships', 'crm'],
      ['relationships', 'communications'],
      ['relationships', 'family_connection'],
      ['relationships', 'evenings_forms'],
      ['student_information', 'students'],
      ['student_information', 'early_warning'],
      ['student_information', 'attendance'],
      ['student_information', 'pastoral'],
      ['learning', 'courses'],
      ['learning', 'timetable'],
      ['learning', 'teachers_classes'],
      ['learning', 'staff_cover'],
      ['learning', 'exams'],
      ['learning', 'reports'],
      ['finance', 'fees'],
      ['finance', 'accounting'],
      ['transport', 'routes'],
      ['transport', 'pickup'],
      ['settings', 'academic_year'],
      ['settings', 'users_roles'],
      ['settings', 'school_settings'],
    ]);
    expect(StaffPageId.options).toEqual(STAFF_PAGES.map((p) => p.id));
    expect(StaffNavGroup.options).toEqual([...new Set(STAFF_PAGES.map((p) => p.group))]);
  });

  it.each<[StaffPageId, PagePredicate]>([
    [
      'dashboard',
      {
        kind: 'any_of',
        keys: ['admissions.view', 'crm.view', 'fees.view', 'finance.view', 'settings.view'],
      },
    ],
    ['communications', { kind: 'everyone' }],
    ['my_teaching', { kind: 'any_of', keys: ['lms.create'] }],
    ['timetable', { kind: 'view', module: 'lms' }],
    ['courses', { kind: 'view', module: 'lms' }],
    ['teachers_classes', { kind: 'view', module: 'lms' }],
    ['staff_cover', { kind: 'view', module: 'lms' }],
    ['exams', { kind: 'view', module: 'lms' }],
    ['reports', { kind: 'view', module: 'lms' }],
    ['students', { kind: 'view', module: 'sis' }],
    ['early_warning', { kind: 'any_of', keys: ['sis.create'] }],
    ['pastoral', { kind: 'any_of', keys: ['sis.create', 'lms.create'] }],
    ['attendance', { kind: 'view', module: 'attendance' }],
    ['admissions', { kind: 'view', module: 'admissions' }],
    ['crm', { kind: 'view', module: 'crm' }],
    ['family_connection', { kind: 'view', module: 'crm' }],
    ['evenings_forms', { kind: 'view', module: 'crm' }],
    ['fees', { kind: 'view', module: 'fees' }],
    ['accounting', { kind: 'view', module: 'finance' }],
    ['routes', { kind: 'view', module: 'transport' }],
    ['pickup', { kind: 'view', module: 'transport' }],
    ['academic_year', { kind: 'view', module: 'settings' }],
    ['school_settings', { kind: 'view', module: 'settings' }],
    ['users_roles', { kind: 'any_of', keys: ['users.manage'] }],
  ])('%s is visible when %j (OQ4)', (id, requires) => {
    expect(byId(id).requires).toEqual(requires);
  });

  it.each<[StaffPageId, string]>([
    ['dashboard', '/app'],
    ['my_teaching', '/app/teaching'],
    ['communications', '/app/messages'],
    ['students', '/app/students'],
    ['attendance', '/app/attendance'],
    ['fees', '/app/fees'],
    ['users_roles', '/app/settings/users'],
    ['school_settings', '/app/settings/school'],
  ])('%s opens %s', (id, href) => {
    expect(byId(id).href).toBe(href);
  });

  it('gives every page a distinct /app href', () => {
    const hrefs = STAFF_PAGES.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^\/app(\/[a-z-]+)*$/);
  });

  it('only names real permission keys', () => {
    for (const page of STAFF_PAGES) {
      if (page.requires.kind === 'any_of') {
        for (const key of page.requires.keys)
          expect(PermissionKey.safeParse(key).success).toBe(true);
      }
    }
  });

  it('ties a page to a plan module only when every row it reads belongs to that module', () => {
    // So permissions already filtered by plan agree with the page's own plan check.
    for (const page of STAFF_PAGES) {
      const plans = new Set(modulesOf(page.requires).map((m) => PERMISSION_MODULE_PLAN[m]));
      if (page.planModule === undefined) {
        expect(plans.size === 1 && !plans.has(null), page.id).toBe(false);
      } else {
        expect([...plans], page.id).toEqual([page.planModule]);
      }
    }
  });

  it.each<[StaffPageId, string | undefined]>([
    ['dashboard', undefined],
    ['communications', undefined],
    ['pastoral', undefined],
    ['users_roles', undefined],
    ['school_settings', undefined],
    ['attendance', 'sis'],
    ['my_teaching', 'lms'],
    ['routes', 'transport'],
    ['accounting', 'finance'],
  ])('%s belongs to plan module %s', (id, planModule) => {
    expect(byId(id).planModule).toBe(planModule);
  });

  it('names the pages that need more than View to be full (fullWhen)', () => {
    expect(STAFF_PAGES.filter((p) => p.fullWhen).map((p) => [p.id, p.fullWhen])).toEqual([
      // A counsellor (sis view and create) adds pastoral notes but does not edit records.
      ['students', ['sis.edit']],
      // Teachers (lms 11100) read these; approvers (principal, admin) run them.
      ['timetable', ['lms.approve']],
      ['teachers_classes', ['lms.approve']],
      ['staff_cover', ['lms.approve']],
    ]);
    for (const page of STAFF_PAGES) {
      for (const key of page.fullWhen ?? []) {
        expect(PermissionKey.safeParse(key).success).toBe(true);
        expect(Object.isFrozen(page.fullWhen)).toBe(true);
      }
    }
  });

  it('is frozen data', () => {
    expect(Object.isFrozen(STAFF_PAGES)).toBe(true);
    for (const page of STAFF_PAGES) {
      expect(Object.isFrozen(page)).toBe(true);
      expect(Object.isFrozen(page.requires)).toBe(true);
      if (page.requires.kind === 'any_of') expect(Object.isFrozen(page.requires.keys)).toBe(true);
    }
  });
});

describe('PageAccess', () => {
  it('is hidden, view only or full', () => {
    expect(PageAccess.options).toEqual(['hidden', 'view_only', 'full']);
  });

  it('StaffPageAccess pairs a page with its access', () => {
    expect(StaffPageAccess.parse({ id: 'fees', access: 'view_only' })).toEqual({
      id: 'fees',
      access: 'view_only',
    });
    expect(StaffPageAccess.safeParse({ id: 'canteen', access: 'full' }).success).toBe(false);
    expect(StaffPageAccess.safeParse({ id: 'fees', access: 'read' }).success).toBe(false);
  });

  it('says why a hidden page is hidden: the plan or the role (D52)', () => {
    expect(StaffPageAccess.parse({ id: 'fees', access: 'hidden', hiddenBy: 'plan' })).toEqual({
      id: 'fees',
      access: 'hidden',
      hiddenBy: 'plan',
    });
    expect(StaffPageAccess.parse({ id: 'fees', access: 'hidden', hiddenBy: 'role' }).hiddenBy).toBe(
      'role',
    );
    const unknown = StaffPageAccess.safeParse({ id: 'fees', access: 'hidden', hiddenBy: 'url' });
    expect(unknown.error?.issues[0]?.path).toEqual(['hiddenBy']);
  });

  it('gives a reason only for a hidden page', () => {
    const open = StaffPageAccess.safeParse({ id: 'fees', access: 'full', hiddenBy: 'plan' });
    expect(open.success).toBe(false);
    expect(open.error?.issues[0]?.path).toEqual(['hiddenBy']);
  });
});
