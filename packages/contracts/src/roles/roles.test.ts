import { describe, expect, it } from 'vitest';

import {
  PermissionModule,
  Role,
  RoleCreateInput,
  RoleList,
  RolePermissionsInput,
  RoleUpdateInput,
} from '../index';

const ROLE_ID = '0192a6f4-1b2c-7d3e-8f40-123456789abd';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

const VIEW = { view: true, create: false, edit: false, delete: false, approve: false };
const fullMatrix = Object.fromEntries(PermissionModule.options.map((module) => [module, VIEW]));

describe('Role (GET /roles)', () => {
  const role = {
    id: ROLE_ID,
    key: 'head_of_year',
    name: 'Head of Year',
    description: null,
    color: '#1B7F53',
    system: false,
    scope: 'school',
    baseRoleKey: 'teacher',
    memberCount: 3,
    pageCount: 9,
    home: 'dashboard',
    matrix: fullMatrix,
    sensitive: ['medical'],
  };

  it('has the members, pages and home the Preview card needs, and its matrix', () => {
    expect(Role.safeParse(role).success).toBe(true);
  });

  it.each([
    [{ home: 'nowhere' }, ['home']],
    [{ sensitive: ['secrets'] }, ['sensitive', 0]],
    [{ matrix: { ...fullMatrix, fees: undefined } }, ['matrix', 'fees']],
  ])('refuses %j at its path', (change, path) => {
    expect(pathOf(Role.safeParse({ ...role, ...change }))).toEqual(path);
  });
});

describe('RoleList (GET /roles)', () => {
  it("names the matrix rows outside the school's plan, so the editor shows them Not in plan", () => {
    const list = { items: [], nextCursor: null, outsidePlan: ['transport'] };
    expect(RoleList.safeParse(list).success).toBe(true);
    expect(pathOf(RoleList.safeParse({ ...list, outsidePlan: ['parent'] }))).toEqual([
      'outsidePlan',
      0,
    ]);
    expect(pathOf(RoleList.safeParse({ items: [], nextCursor: null }))).toEqual(['outsidePlan']);
  });
});

describe('RoleCreateInput (POST /roles)', () => {
  const input = {
    name: 'Head of Year',
    description: 'Leads a year group',
    color: '#1B7F53',
    scope: 'school',
    baseRoleKey: 'teacher',
  };

  it('takes a name, a description, a colour, a scope and the role it starts from', () => {
    expect(RoleCreateInput.safeParse(input).success).toBe(true);
    expect(RoleCreateInput.safeParse({ ...input, baseRoleKey: null }).success).toBe(true);
  });

  it('may carry the whole grant, so the role is created with it in one step (Task 21 fix)', () => {
    const row = { view: true, create: false, edit: false, delete: false, approve: false };
    const permissions = { matrix: { sis: row }, sensitive: ['medical'] };
    expect(RoleCreateInput.safeParse({ ...input, permissions }).success).toBe(true);
    expect(
      pathOf(
        RoleCreateInput.safeParse({
          ...input,
          permissions: { matrix: {}, sensitive: ['medical', 'medical'] },
        }),
      ),
    ).toEqual(['permissions', 'sensitive', 1]);
  });

  it.each([
    [{ name: '  ' }, ['name']],
    [{ name: 'x'.repeat(61) }, ['name']],
    [{ description: 'x'.repeat(301) }, ['description']],
    [{ color: 'green' }, ['color']],
    [{ scope: 'galaxy' }, ['scope']],
    [{ baseRoleKey: '' }, ['baseRoleKey']],
    [{ system: true }, []],
  ])('refuses %j at its path', (change, path) => {
    expect(pathOf(RoleCreateInput.safeParse({ ...input, ...change }))).toEqual(path);
  });
});

describe('RoleUpdateInput (PATCH /roles/:id)', () => {
  it('takes any of the name, description, colour and scope', () => {
    expect(RoleUpdateInput.safeParse({ name: 'Year lead' }).success).toBe(true);
    expect(RoleUpdateInput.safeParse({ description: null }).success).toBe(true);
  });

  it.each([
    [{}, []],
    [{ name: '' }, ['name']],
    [{ key: 'admin' }, []],
  ])('refuses %j at its path', (input, path) => {
    expect(pathOf(RoleUpdateInput.safeParse(input))).toEqual(path);
  });
});

describe('RolePermissionsInput (PUT /roles/:id/permissions)', () => {
  it('takes rows for some modules and the sensitive keys', () => {
    const input = { matrix: { fees: VIEW }, sensitive: ['export_data'] };
    expect(RolePermissionsInput.safeParse(input).success).toBe(true);
  });

  it.each([
    [{ matrix: { galaxy: VIEW } }, ['matrix']],
    [{ matrix: { fees: { ...VIEW, fly: true } } }, ['matrix', 'fees']],
    [{ matrix: { fees: { view: 'yes' } } }, ['matrix', 'fees', 'view']],
    [{ sensitive: ['secrets'] }, ['sensitive', 0]],
    [{ sensitive: ['medical', 'medical'] }, ['sensitive', 1]],
  ])('refuses %j at its path', (change, path) => {
    const input = { matrix: {}, sensitive: [], ...change };
    expect(pathOf(RolePermissionsInput.safeParse(input))).toEqual(path);
  });
});
