import { PlanModule } from '@quad/contracts';
import { describe, expect, it } from 'vitest';

import { effectivePermissions } from './effective-permissions';
import { roleHome } from './role-home';
import { systemRoleMatrix } from './system-roles';

import type { PermissionKey, RoleScope, StaffPageId, SystemRoleKey } from '@quad/contracts';

const permsOf = (key: SystemRoleKey) =>
  effectivePermissions({
    roles: [systemRoleMatrix(key)],
    planModules: PlanModule.options,
    adminSensitive: [],
  });

describe('roleHome (spec 08: teachers start on My teaching, front desk on Attendance)', () => {
  it.each<[SystemRoleKey, StaffPageId]>([
    ['admin', 'dashboard'],
    ['principal', 'dashboard'],
    ['finance', 'dashboard'],
    ['admissions', 'dashboard'],
    ['teacher', 'my_teaching'],
    ['counsellor', 'dashboard'],
    ['frontdesk', 'attendance'],
  ])('%s starts on %s', (key, home) => {
    expect(roleHome(permsOf(key), systemRoleMatrix(key).scope)).toBe(home);
  });

  it('does not give My teaching to lms.create with a whole-school scope', () => {
    expect(roleHome(permsOf('teacher'), 'school')).toBe('attendance');
  });

  it.each<[string, PermissionKey[], RoleScope, StaffPageId]>([
    [
      'My teaching wins over Dashboard for own classes',
      ['lms.create', 'fees.view'],
      'own_classes',
      'my_teaching',
    ],
    [
      'own classes without lms.create',
      ['attendance.view', 'fees.view'],
      'own_classes',
      'dashboard',
    ],
    ['Dashboard wins over Attendance', ['attendance.view', 'crm.view'], 'school', 'dashboard'],
    [
      'with a campus scope, My teaching only as the first visible page',
      ['lms.create'],
      'campus',
      'my_teaching',
    ],
    ['the first visible page otherwise', ['sis.view'], 'school', 'communications'],
    ['Communications comes before Courses in the menu', ['lms.view'], 'school', 'communications'],
    ['nothing at all still has Communications', [], 'school', 'communications'],
  ])('%s', (_name, keys, scope, home) => {
    expect(roleHome(new Set(keys), scope)).toBe(home);
  });
});
