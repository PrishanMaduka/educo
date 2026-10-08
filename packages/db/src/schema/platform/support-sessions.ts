import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { bytea } from '../types';

import { platformUsers } from './platform-users';
import { tenants } from './tenants';

/**
 * A reasoned, time-limited support visit to one school (spec 04, Platform; spec 05, Support
 * access). Platform table: closed to `quad_app`.
 */
export const supportSessions = pgTable(
  'support_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    platformUserId: uuid('platform_user_id')
      .notNull()
      .references(() => platformUsers.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    /** Always required (D22). */
    reason: text('reason').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** 60 minutes after it starts (spec 05). */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /**
     * SHA-256 of the support cookie, set once by `redeem_support_session` (ruling R-support-token).
     * `session_by_token` resolves it, so a support visit never needs a `sessions` row.
     */
    tokenHash: bytea('token_hash').unique(),
  },
  (table) => [
    index('support_sessions_platform_user_id_idx').on(table.platformUserId),
    index('support_sessions_tenant_id_idx').on(table.tenantId),
  ],
);

export type SupportSession = typeof supportSessions.$inferSelect;
export type NewSupportSession = typeof supportSessions.$inferInsert;
