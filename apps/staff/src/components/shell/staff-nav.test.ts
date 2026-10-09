import { STAFF_PAGES, type StaffPageAccess } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { accessOf, hrefOf, pageAtPath, roleNameOf, visibleNav } from './staff-nav';

const all = (access: StaffPageAccess['access']): StaffPageAccess[] =>
  STAFF_PAGES.map((page) => ({ id: page.id, access }));

describe('visibleNav', () => {
  it('keeps side bar order and groups, dropping hidden pages and groups left empty', () => {
    const access: StaffPageAccess[] = all('hidden').map((entry) =>
      entry.id === 'attendance' || entry.id === 'communications' || entry.id === 'my_teaching'
        ? { ...entry, access: entry.id === 'attendance' ? 'view_only' : 'full' }
        : entry,
    );
    expect(
      visibleNav(access).map(({ group, pages }) => [group, pages.map((p) => [p.id, p.access])]),
    ).toEqual([
      ['overview', [['my_teaching', 'full']]],
      ['relationships', [['communications', 'full']]],
      ['student_information', [['attendance', 'view_only']]],
    ]);
  });

  it('shows every page and group when everything opens', () => {
    const nav = visibleNav(all('full'));
    expect(nav.flatMap((group) => group.pages.map((page) => page.id))).toEqual(
      STAFF_PAGES.map((page) => page.id),
    );
    expect(nav[0]?.pages[0]).toMatchObject({ id: 'dashboard', href: '/app', exact: true });
  });

  it('treats a page the API did not list as hidden', () => {
    expect(visibleNav([])).toEqual([]);
    expect(accessOf([], 'fees')).toBe('hidden');
    expect(accessOf([{ id: 'fees', access: 'view_only' }], 'fees')).toBe('view_only');
  });
});

describe('pageAtPath and hrefOf', () => {
  it('finds a page by its exact path, with or without a trailing slash', () => {
    expect(pageAtPath('/app/transport/routes')?.id).toBe('routes');
    expect(pageAtPath('/app/settings/users/')?.id).toBe('users_roles');
    expect(pageAtPath('/app')?.id).toBe('dashboard');
    expect(pageAtPath('/app/settings')).toBeUndefined();
    expect(pageAtPath('/app/no-such-page')).toBeUndefined();
  });

  it('gives each page its path', () => {
    expect(hrefOf('my_teaching')).toBe('/app/teaching');
    expect(hrefOf('dashboard')).toBe('/app');
  });
});

describe('roleNameOf', () => {
  const person = {
    name: 'Prishan Maduka',
    firstName: 'Prishan',
    theme: 'system',
    locale: 'en-LK',
    roleNames: ['School admin', 'Teacher'],
  } as const;

  it('is the previewed role while a preview is on, else the primary role', () => {
    expect(
      roleNameOf({ person: { ...person, roleNames: [...person.roleNames] }, preview: null }),
    ).toBe('School admin');
    expect(
      roleNameOf({
        person: { ...person, roleNames: [...person.roleNames] },
        preview: {
          roleId: '0190a000-0000-7000-8000-000000000001',
          roleName: 'Teacher',
          sampleUser: null,
        },
      }),
    ).toBe('Teacher');
    expect(roleNameOf({ person: { ...person, roleNames: [] }, preview: null })).toBeNull();
  });
});
