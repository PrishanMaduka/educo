import { SessionKind, SessionStage } from '@quad/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { platformUsers } from '../platform/platform-users';
import { supportSessions } from '../platform/support-sessions';
import { tenants } from '../platform/tenants';
import { bytea, inet } from '../types';

import { accounts } from './accounts';

export const sessionKind = pgEnum('session_kind', SessionKind.options);
export const sessionStage = pgEnum('session_stage', SessionStage.options);

/**
 * A signed-in browser, phone or console tab (spec 04, Identity; spec 05). Account table keyed on
 * `account_id`: console rows (no account, a platform user) are invisible to `quad_app` and are
 * reached through `withPlatform`. The `active_user_id` and preview foreign keys to `users` and
 * `roles` arrive with those tables (0005).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    accountId: uuid('account_id').references(() => accounts.id),
    platformUserId: uuid('platform_user_id').references(() => platformUsers.id),
    /** Null until a school is chosen. */
    activeTenantId: uuid('active_tenant_id').references(() => tenants.id),
    /** The membership (`users.id`) in the active school. */
    activeUserId: uuid('active_user_id'),
    kind: sessionKind('kind').notNull(),
    /** Where the person is in the sign-in steps; only `active` reaches school routes. */
    stage: sessionStage('stage').notNull(),
    /** SHA-256 of the opaque session cookie. Null for mobile sessions, which use refresh tokens. */
    tokenHash: bytea('token_hash').unique(),
    /** Hash of the current mobile refresh secret. */
    refreshHash: bytea('refresh_hash'),
    /** Increases on every refresh rotation; an older generation means reuse. */
    refreshGeneration: integer('refresh_generation').notNull().default(0),
    keepSignedIn: boolean('keep_signed_in').notNull().default(false),
    previewRoleId: uuid('preview_role_id'),
    previewSampleUserId: uuid('preview_sample_user_id'),
    supportSessionId: uuid('support_session_id').references(() => supportSessions.id),
    deviceName: text('device_name'),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    check('sessions_one_owner', sql`num_nonnulls(${table.accountId}, ${table.platformUserId}) = 1`),
    index('sessions_account_id_revoked_at_idx').on(table.accountId, table.revokedAt),
    index('sessions_active_tenant_id_active_user_id_idx').on(
      table.activeTenantId,
      table.activeUserId,
    ),
    index('sessions_platform_user_id_idx').on(table.platformUserId),
    index('sessions_support_session_id_idx').on(table.supportSessionId),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
