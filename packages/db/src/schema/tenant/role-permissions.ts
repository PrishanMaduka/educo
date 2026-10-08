import { PermissionModule } from '@quad/contracts';
import { bit, foreignKey, pgEnum, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { tenants } from '../platform/tenants';

import { roles } from './roles';

export const permissionModule = pgEnum('permission_module', PermissionModule.options);

/**
 * One row of a role's permission matrix (spec 05) [T]. `actions` is `bit(5)` in
 * `PermissionAction` order (view, create, edit, delete, approve). The primary key leads with
 * `(tenant_id, role_id)`, so it also serves lookups by role.
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    roleId: uuid('role_id').notNull(),
    module: permissionModule('module').notNull(),
    actions: bit('actions', { dimensions: 5 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.roleId, table.module] }),
    // Deleting a role takes its matrix with it.
    foreignKey({
      name: 'role_permissions_tenant_id_role_id_roles_fk',
      columns: [table.tenantId, table.roleId],
      foreignColumns: [roles.tenantId, roles.id],
    }).onDelete('cascade'),
  ],
);

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
