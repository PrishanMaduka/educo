import { PlanModule, RoleScope, SystemRoleKey } from '@quad/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { effectivePermissions } from './effective-permissions';
import { pageAccess } from './page-access';
import { roleHome } from './role-home';
import { systemRoleMatrix } from './system-roles';

import type { PermissionKey, StaffPageId } from '@quad/contracts';

const EVERY_MODULE = PlanModule.options;

const permsOf = (key: SystemRoleKey, planModules: readonly PlanModule[] = EVERY_MODULE) =>
  effectivePermissions({ roles: [systemRoleMatrix(key)], planModules });

describe('roleHome (spec 08: teachers start on My teaching, front desk on Attendance)', () => {
  it.each<[SystemRoleKey, StaffPageId]>([
    ['admin', 'dashboard'],
    ['principal', 'dashboard'],
    ['finance', 'dashboard'],
    ['admissions', 'dashboard'],
    ['teacher', 'my_teaching'],
    // No Dashboard row since the counsellor dropped CRM; Attendance is open (View only).
    ['counsellor', 'attendance'],
    ['frontdesk', 'attendance'],
  ])('%s starts on %s', (key, home) => {
    expect(roleHome(permsOf(key), systemRoleMatrix(key).scope, EVERY_MODULE)).toBe(home);
  });

  it('does not give My teaching to lms.create with a whole-school scope', () => {
    expect(roleHome(permsOf('teacher'), 'school', EVERY_MODULE)).toBe('attendance');
  });

  it.each<[string, PermissionKey[], RoleScope, readonly PlanModule[], StaffPageId]>([
    [
      'My teaching wins over Dashboard for own classes',
      ['lms.create', 'fees.view'],
      'own_classes',
      EVERY_MODULE,
      'my_teaching',
    ],
    [
      'own classes without lms.create',
      ['attendance.view', 'fees.view'],
      'own_classes',
      EVERY_MODULE,
      'dashboard',
    ],
    [
      'not My teaching when the plan lacks lms',
      ['lms.create', 'attendance.view'],
      'own_classes',
      ['sis'],
      'attendance',
    ],
    [
      'Dashboard wins over Attendance',
      ['attendance.view', 'crm.view'],
      'school',
      EVERY_MODULE,
      'dashboard',
    ],
    [
      'not Attendance when the plan lacks sis',
      ['attendance.view'],
      'school',
      ['lms'],
      'communications',
    ],
    [
      'with a campus scope, My teaching only as the first open page',
      ['lms.create'],
      'campus',
      EVERY_MODULE,
      'my_teaching',
    ],
    ['the first open page otherwise', ['sis.view'], 'school', EVERY_MODULE, 'communications'],
    [
      'Communications comes before Courses in the menu',
      ['lms.view'],
      'school',
      EVERY_MODULE,
      'communications',
    ],
    ['nothing at all still has Communications', [], 'school', [], 'communications'],
  ])('%s', (_name, keys, scope, planModules, home) => {
    expect(roleHome(new Set(keys), scope, planModules)).toBe(home);
  });

  it('never starts on a page pageAccess hides, for any system role, plan and scope (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SystemRoleKey.options),
        fc.subarray([...PlanModule.options]),
        fc.constantFrom(...RoleScope.options),
        (key, planModules, scope) => {
          const perms = permsOf(key, planModules);
          const home = roleHome(perms, scope, planModules);
          const access = pageAccess(perms, planModules).find((p) => p.id === home)?.access;
          expect(access).not.toBe('hidden');
        },
      ),
    );
  });
});
