import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { tenants } from '../platform/tenants';

import { roles } from './roles';
import { users } from './users';

/**
 * A role held by a membership (spec 04, Identity) [T]. At most one is primary; the primary
 * role's scope picks the home page (spec 08). A role still assigned cannot be deleted.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
    primary: boolean('primary').notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.userId, table.roleId] }),
    uniqueIndex('user_roles_one_primary_idx')
      .on(table.tenantId, table.userId)
      .where(sql`${table.primary}`),
    index('user_roles_tenant_id_role_id_idx').on(table.tenantId, table.roleId),
    foreignKey({
      name: 'user_roles_tenant_id_user_id_users_fk',
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
    }),
    foreignKey({
      name: 'user_roles_tenant_id_role_id_roles_fk',
      columns: [table.tenantId, table.roleId],
      foreignColumns: [roles.tenantId, roles.id],
    }),
  ],
);

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
