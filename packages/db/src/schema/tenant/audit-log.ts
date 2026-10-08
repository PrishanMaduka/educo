import { sql } from 'drizzle-orm';
import { foreignKey, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { platformUsers } from '../platform/platform-users';
import { supportSessions } from '../platform/support-sessions';
import { tenants } from '../platform/tenants';
import { inet } from '../types';

import { users } from './users';

/**
 * Who did what in one school (spec 04, Identity; spec 05, Audit) [T]. Append-only: the shared
 * `refuse_append_only_change()` trigger refuses UPDATE, DELETE and TRUNCATE for every role. In a
 * support session the actor is the Quad staff member and `support_session_id` marks the row.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    /** Null for system jobs and support sessions. */
    actorUserId: uuid('actor_user_id'),
    actorPlatformUserId: uuid('actor_platform_user_id').references(() => platformUsers.id),
    supportSessionId: uuid('support_session_id').references(() => supportSessions.id),
    /** A stable `area.verb` key, for example `role_preview.started`. */
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: uuid('target_id'),
    meta: jsonb('meta')
      .notNull()
      .default(sql`'{}'::jsonb`),
    ip: inet('ip'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'audit_log_tenant_id_actor_user_id_users_fk',
      columns: [table.tenantId, table.actorUserId],
      foreignColumns: [users.tenantId, users.id],
    }),
    index('audit_log_tenant_id_at_idx').on(table.tenantId, table.at.desc()),
    index('audit_log_tenant_id_actor_user_id_at_idx').on(
      table.tenantId,
      table.actorUserId,
      table.at.desc(),
    ),
    index('audit_log_tenant_id_action_at_idx').on(table.tenantId, table.action, table.at.desc()),
    index('audit_log_actor_platform_user_id_idx')
      .on(table.actorPlatformUserId)
      .where(sql`${table.actorPlatformUserId} IS NOT NULL`),
    index('audit_log_support_session_id_idx')
      .on(table.supportSessionId)
      .where(sql`${table.supportSessionId} IS NOT NULL`),
  ],
);

export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;
