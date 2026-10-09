import { PermissionKey, PermissionModule, PlanModule, SensitiveKey } from '@quad/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { effectivePermissions } from './effective-permissions';
import { rowOf } from './matrix';
import { systemRoleMatrix } from './system-roles';

import type { PermissionMatrix, RoleGrant } from './matrix';
import type { SystemRoleKey } from '@quad/contracts';

const EVERY_MODULE = PlanModule.options;
const sorted = (keys: Iterable<PermissionKey>): PermissionKey[] => [...keys].sort();
const role = (matrix: PermissionMatrix, sensitive: readonly SensitiveKey[] = []): RoleGrant => ({
  matrix,
  sensitive,
});

const arbMatrix: fc.Arbitrary<PermissionMatrix> = fc.record(
  Object.fromEntries(
    PermissionModule.options.map((m) => [
      m,
      fc.stringMatching(/^[01]{5}$/).map((bits) => rowOf(bits)),
    ]),
  ),
  { requiredKeys: [] },
);
const arbSensitive = fc.subarray([...SensitiveKey.options]);
const arbRole: fc.Arbitrary<RoleGrant> = fc.record({ matrix: arbMatrix, sensitive: arbSensitive });
const arbPlan = fc.subarray([...PlanModule.options]);

describe('effectivePermissions (spec 05)', () => {
  it('gives nothing without roles', () => {
    const perms = effectivePermissions({
      roles: [],
      planModules: EVERY_MODULE,
      adminSensitive: [],
    });
    expect(perms.size).toBe(0);
  });

  it('turns a matrix into <module>.<action> keys', () => {
    const perms = effectivePermissions({
      roles: [systemRoleMatrix('finance')],
      planModules: EVERY_MODULE,
      adminSensitive: [],
    });
    expect(sorted(perms)).toEqual(
      sorted([
        'sis.view',
        'fees.view',
        'fees.create',
        'fees.edit',
        'fees.delete',
        'fees.approve',
        'finance.view',
        'finance.create',
        'finance.edit',
        'finance.delete',
        'finance.approve',
      ]),
    );
  });

  it('joins the keys of several roles and their sensitive keys', () => {
    const perms = effectivePermissions({
      roles: [systemRoleMatrix('teacher'), role({ fees: rowOf('10000') }, ['export_data'])],
      planModules: EVERY_MODULE,
      adminSensitive: [],
    });
    expect(perms.has('lms.edit')).toBe(true);
    expect(perms.has('fees.view')).toBe(true);
    expect(perms.has('sensitive.export_data')).toBe(true);
    expect(perms.has('fees.create')).toBe(false);
  });

  it('reads a row without View as no access', () => {
    const perms = effectivePermissions({
      roles: [role({ crm: rowOf('01111') })],
      planModules: EVERY_MODULE,
      adminSensitive: [],
    });
    expect(perms.size).toBe(0);
  });

  describe('the plan (spec 05, Plan and module guard)', () => {
    it('drops the rows of modules outside the plan', () => {
      const perms = effectivePermissions({
        roles: [systemRoleMatrix('admin')],
        planModules: ['admissions', 'sis', 'fees', 'parent'],
        adminSensitive: [],
      });
      for (const m of ['crm', 'lms', 'finance', 'transport'] as const) {
        expect(perms.has(`${m}.view`), m).toBe(false);
      }
      expect(perms.has('admissions.approve')).toBe(true);
      expect(perms.has('attendance.edit')).toBe(true);
    });

    it('keeps settings (and so users.manage) in every plan', () => {
      const perms = effectivePermissions({
        roles: [systemRoleMatrix('admin')],
        planModules: [],
        adminSensitive: [],
      });
      expect(sorted(perms)).toEqual(
        sorted([
          'settings.view',
          'settings.create',
          'settings.edit',
          'settings.delete',
          'settings.approve',
          'users.manage',
          'sensitive.safeguarding',
          'sensitive.medical',
          'sensitive.finance_reports',
          'sensitive.export_data',
        ]),
      );
    });

    it('drops attendance with student records, its plan module', () => {
      const perms = effectivePermissions({
        roles: [systemRoleMatrix('teacher')],
        planModules: ['lms'],
        adminSensitive: [],
      });
      expect(perms.has('attendance.view')).toBe(false);
      expect(perms.has('lms.view')).toBe(true);
    });
  });

  describe('users.manage (OQ3)', () => {
    it.each<[SystemRoleKey, boolean]>([
      ['admin', true],
      ['principal', false],
      ['finance', false],
      ['teacher', false],
    ])('%s: %s', (key, expected) => {
      const perms = effectivePermissions({
        roles: [systemRoleMatrix(key)],
        planModules: EVERY_MODULE,
        adminSensitive: [],
      });
      expect(perms.has('users.manage')).toBe(expected);
    });

    it('comes with settings.edit on a custom role', () => {
      const perms = effectivePermissions({
        roles: [role({ settings: rowOf('10100') })],
        planModules: [],
        adminSensitive: [],
      });
      expect(perms.has('users.manage')).toBe(true);
    });
  });

  describe('a preview (spec 06 POST /me/role-preview; spec 08 Preview a role)', () => {
    it("uses the previewed role's matrix instead of the admin's", () => {
      const perms = effectivePermissions({
        roles: [systemRoleMatrix('admin')],
        planModules: EVERY_MODULE,
        preview: systemRoleMatrix('finance'),
        adminSensitive: ['safeguarding', 'medical', 'finance_reports', 'export_data'],
      });
      expect(perms.has('fees.approve')).toBe(true);
      expect(perms.has('lms.view')).toBe(false);
      expect(perms.has('users.manage')).toBe(false);
      expect(perms.has('sensitive.safeguarding')).toBe(false);
    });

    it("keeps only the previewed role's sensitive keys the admin also holds", () => {
      const perms = effectivePermissions({
        roles: [role({ settings: rowOf('11111') })],
        planModules: EVERY_MODULE,
        preview: role({ sis: rowOf('11000') }, ['medical', 'export_data']),
        adminSensitive: ['export_data'],
      });
      expect(perms.has('sensitive.export_data')).toBe(true);
      expect(perms.has('sensitive.medical')).toBe(false);
    });

    it('still drops modules outside the plan', () => {
      const perms = effectivePermissions({
        roles: [systemRoleMatrix('admin')],
        planModules: ['sis'],
        preview: systemRoleMatrix('finance'),
        adminSensitive: [],
      });
      expect(sorted(perms)).toEqual(['sis.view']);
    });

    it('never adds a sensitive key the admin lacks (property)', () => {
      fc.assert(
        fc.property(
          fc.array(arbRole, { maxLength: 3 }),
          arbPlan,
          arbRole,
          arbSensitive,
          (roles, planModules, preview, adminSensitive) => {
            const perms = effectivePermissions({ roles, planModules, preview, adminSensitive });
            for (const key of SensitiveKey.options) {
              if (!adminSensitive.includes(key)) {
                expect(perms.has(`sensitive.${key}`)).toBe(false);
              }
            }
          },
        ),
      );
    });
  });

  describe('a support session (spec 05, Support access)', () => {
    it('gets the admin matrix minus safeguarding and medical, whatever the roles', () => {
      const perms = effectivePermissions({
        roles: [systemRoleMatrix('teacher')],
        planModules: EVERY_MODULE,
        support: true,
        adminSensitive: [],
      });
      const admin = effectivePermissions({
        roles: [systemRoleMatrix('admin')],
        planModules: EVERY_MODULE,
        adminSensitive: [],
      });
      admin.delete('sensitive.safeguarding');
      admin.delete('sensitive.medical');
      expect(sorted(perms)).toEqual(sorted(admin));
      expect(perms.has('users.manage')).toBe(true);
    });

    it('is limited to the plan like anyone else', () => {
      const perms = effectivePermissions({
        roles: [],
        planModules: ['sis'],
        support: true,
        adminSensitive: [],
      });
      expect(perms.has('sis.delete')).toBe(true);
      expect(perms.has('fees.view')).toBe(false);
    });

    it('never sees safeguarding or medical, even previewing a role that has them', () => {
      const perms = effectivePermissions({
        roles: [],
        planModules: EVERY_MODULE,
        support: true,
        preview: systemRoleMatrix('admin'),
        adminSensitive: ['safeguarding', 'medical', 'finance_reports', 'export_data'],
      });
      expect(perms.has('sensitive.safeguarding')).toBe(false);
      expect(perms.has('sensitive.medical')).toBe(false);
      expect(perms.has('sensitive.export_data')).toBe(true);
    });

    it('never sees safeguarding or medical (property)', () => {
      fc.assert(
        fc.property(
          fc.array(arbRole, { maxLength: 3 }),
          arbPlan,
          fc.option(arbRole, { nil: undefined }),
          arbSensitive,
          (roles, planModules, preview, adminSensitive) => {
            const perms = effectivePermissions({
              roles,
              planModules,
              preview,
              adminSensitive,
              support: true,
            });
            expect(perms.has('sensitive.safeguarding')).toBe(false);
            expect(perms.has('sensitive.medical')).toBe(false);
          },
        ),
      );
    });
  });

  it('never gives an action without View on the same module (property)', () => {
    fc.assert(
      fc.property(
        fc.array(arbRole, { maxLength: 3 }),
        arbPlan,
        fc.option(arbRole, { nil: undefined }),
        arbSensitive,
        fc.boolean(),
        (roles, planModules, preview, adminSensitive, support) => {
          const perms = effectivePermissions({
            roles,
            planModules,
            preview,
            adminSensitive,
            support,
          });
          for (const key of perms) {
            const [module] = key.split('.');
            if (module !== 'sensitive' && module !== 'users') {
              expect(perms.has(PermissionKey.parse(`${module}.view`)), key).toBe(true);
            }
          }
        },
      ),
    );
  });

  it('leaves its inputs alone', () => {
    const roles = [systemRoleMatrix('teacher')];
    const planModules = [...EVERY_MODULE];
    const adminSensitive = ['medical'] as const;
    effectivePermissions({ roles, planModules, adminSensitive });
    expect(roles).toEqual([systemRoleMatrix('teacher')]);
    expect(planModules).toEqual([...EVERY_MODULE]);
  });
});
