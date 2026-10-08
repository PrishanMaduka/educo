import { SensitiveKey } from '@quad/contracts';
import { foreignKey, pgEnum, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { tenants } from '../platform/tenants';

import { roles } from './roles';

export const sensitiveKey = pgEnum('sensitive_key', SensitiveKey.options);

/**
 * A sensitive-data key a role holds (spec 05: off by default, every use logged) [T]. The
 * primary key leads with `(tenant_id, role_id)`, so it also serves lookups by role.
 */
export const roleSensitive = pgTable(
  'role_sensitive',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    roleId: uuid('role_id').notNull(),
    key: sensitiveKey('key').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.roleId, table.key] }),
    // Deleting a role takes its keys with it.
    foreignKey({
      name: 'role_sensitive_tenant_id_role_id_roles_fk',
      columns: [table.tenantId, table.roleId],
      foreignColumns: [roles.tenantId, roles.id],
    }).onDelete('cascade'),
  ],
);

export type RoleSensitive = typeof roleSensitive.$inferSelect;
export type NewRoleSensitive = typeof roleSensitive.$inferInsert;
