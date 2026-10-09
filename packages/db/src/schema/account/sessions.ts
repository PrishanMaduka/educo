import { SessionKind, SessionStage, SignInMethod } from '@quad/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
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
import { roles } from '../tenant/roles';
import { users } from '../tenant/users';
import { bytea, inet } from '../types';

import { accounts } from './accounts';

export const sessionKind = pgEnum('session_kind', SessionKind.options);
export const sessionStage = pgEnum('session_stage', SessionStage.options);
export const signInMethod = pgEnum('sign_in_method', SignInMethod.options);

/**
 * A signed-in browser, phone or console tab (spec 04, Identity; spec 05). Account table keyed on
 * `account_id`: console rows (no account, a platform user) are invisible to `quad_app` and are
 * reached through `withPlatform`. The membership and preview ids are composite foreign keys with
 * `active_tenant_id` (0005, D23), so they can only name rows of the active school, and they need
 * a school to be set.
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
    /**
     * The first factor this staff session signed in with (only `password` since 0012, D37), for
     * the `auth.sign_in` audit once it opens a school (0010). Null for mobile and console, and for
     * a session from before 0010 or one that signed in with SSO before 0012.
     */
    signInMethod: signInMethod('sign_in_method'),
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
    // Composite foreign keys are not checked when a column is null, so a membership or preview
    // without a school would escape them.
    check(
      'sessions_school_ids_need_school',
      sql`${table.activeTenantId} IS NOT NULL OR num_nonnulls(${table.activeUserId}, ${table.previewRoleId}, ${table.previewSampleUserId}) = 0`,
    ),
    foreignKey({
      name: 'sessions_active_user_fk',
      columns: [table.activeTenantId, table.activeUserId],
      foreignColumns: [users.tenantId, users.id],
    }),
    foreignKey({
      name: 'sessions_preview_sample_user_fk',
      columns: [table.activeTenantId, table.previewSampleUserId],
      foreignColumns: [users.tenantId, users.id],
    }),
    foreignKey({
      name: 'sessions_preview_role_fk',
      columns: [table.activeTenantId, table.previewRoleId],
      foreignColumns: [roles.tenantId, roles.id],
    }),
    index('sessions_account_id_revoked_at_idx').on(table.accountId, table.revokedAt),
    index('sessions_active_tenant_id_active_user_id_idx').on(
      table.activeTenantId,
      table.activeUserId,
    ),
    index('sessions_preview_role_idx')
      .on(table.activeTenantId, table.previewRoleId)
      .where(sql`${table.previewRoleId} IS NOT NULL`),
    index('sessions_preview_sample_user_idx')
      .on(table.activeTenantId, table.previewSampleUserId)
      .where(sql`${table.previewSampleUserId} IS NOT NULL`),
    index('sessions_platform_user_id_idx').on(table.platformUserId),
    index('sessions_support_session_id_idx').on(table.supportSessionId),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
