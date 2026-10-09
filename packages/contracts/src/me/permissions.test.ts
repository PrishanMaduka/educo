import { describe, expect, it } from 'vitest';

import { MePermissions, RolePreviewInput, STAFF_PAGES } from '../index';

const ROLE_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abd';
const USER_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abe';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

const permissions = {
  keys: ['sis.view', 'users.manage', 'sensitive.medical'],
  pages: STAFF_PAGES.map((page) => ({ id: page.id, access: 'hidden' })),
  home: 'communications',
  preview: null,
};

describe('MePermissions (GET /me/permissions)', () => {
  it('accepts keys, every page with its access, the home page and no preview', () => {
    expect(MePermissions.safeParse(permissions).success).toBe(true);
  });

  it('accepts an active preview', () => {
    const preview = { roleId: ROLE_ID, roleName: 'Teacher', sampleUser: null };
    expect(MePermissions.safeParse({ ...permissions, preview }).success).toBe(true);
  });

  it.each([
    [{ keys: ['fees.fly'] }, ['keys', 0]],
    [{ pages: [{ id: 'nowhere', access: 'full' }] }, ['pages', 0, 'id']],
    [{ pages: [{ id: 'fees', access: 'some' }] }, ['pages', 0, 'access']],
    [{ home: 'nowhere' }, ['home']],
    [{ preview: { roleId: 'x', roleName: 'Teacher', sampleUser: null } }, ['preview', 'roleId']],
  ])('refuses %j at its path', (change, path) => {
    expect(pathOf(MePermissions.safeParse({ ...permissions, ...change }))).toEqual(path);
  });
});

describe('RolePreviewInput (POST /me/role-preview)', () => {
  it('takes a role, and optionally a sample person', () => {
    expect(RolePreviewInput.safeParse({ roleId: ROLE_ID }).success).toBe(true);
    expect(RolePreviewInput.safeParse({ roleId: ROLE_ID, sampleUserId: USER_ID }).success).toBe(
      true,
    );
  });

  it.each([
    [{}, ['roleId']],
    [{ roleId: 'admin' }, ['roleId']],
    [{ roleId: ROLE_ID, sampleUserId: 'someone' }, ['sampleUserId']],
    [{ roleId: ROLE_ID, tenantId: USER_ID }, []],
  ])('refuses %j at its path', (input, path) => {
    expect(pathOf(RolePreviewInput.safeParse(input))).toEqual(path);
  });
});
