import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { inet } from '../types';

import { platformUsers } from './platform-users';
import { tenants } from './tenants';

/**
 * Everything Quad staff do in the console, and support sessions (spec 04, Platform; spec 05,
 * Audit). Platform table, append-only: a trigger refuses UPDATE, DELETE and TRUNCATE.
 */
export const platformAudit = pgTable(
  'platform_audit',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    /** Null for actions with no console user (scheduled platform jobs). */
    actorPlatformUserId: uuid('actor_platform_user_id').references(() => platformUsers.id),
    /** A stable `area.verb` key, for example `tenant.suspended`. */
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: uuid('target_id'),
    /** The school the action was about, if any. */
    tenantId: uuid('tenant_id').references(() => tenants.id),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    meta: jsonb('meta')
      .notNull()
      .default(sql`'{}'::jsonb`),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('platform_audit_actor_platform_user_id_idx').on(table.actorPlatformUserId),
    index('platform_audit_tenant_id_at_idx').on(table.tenantId, table.at.desc()),
    index('platform_audit_at_idx').on(table.at.desc()),
  ],
);

export type PlatformAuditEntry = typeof platformAudit.$inferSelect;
export type NewPlatformAuditEntry = typeof platformAudit.$inferInsert;
