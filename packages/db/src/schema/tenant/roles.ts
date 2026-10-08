import { RoleScope } from '@quad/contracts';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { tenants } from '../platform/tenants';

export const roleScope = pgEnum('role_scope', RoleScope.options);

/**
 * A school's role, system or custom (spec 04, Identity; spec 05, Roles) [T]. `key` is stable
 * (`admin`, `teacher`, … for system roles). `unique (tenant_id, id)` is the target of the
 * composite foreign keys (D23).
 */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /** The swatch picked in the role builder. */
    color: text('color'),
    /** System roles come with every school and cannot be renamed or deleted. */
    system: boolean('system').notNull().default(false),
    scope: roleScope('scope').notNull().default('school'),
    /** The role a custom role started from. */
    baseRoleKey: text('base_role_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Part of the permission cache key (spec 05), so every role or matrix change bumps it. */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique('roles_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('roles_tenant_id_key_unique').on(table.tenantId, table.key),
    index('roles_tenant_id_system_idx').on(table.tenantId, table.system),
  ],
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
