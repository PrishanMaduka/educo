import { MembershipKind, MembershipStatus, ThemeChoice } from '@quad/contracts';
import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { accounts } from '../account/accounts';
import { tenants } from '../platform/tenants';
import { citext } from '../types';

export const membershipKind = pgEnum('membership_kind', MembershipKind.options);
export const membershipStatus = pgEnum('membership_status', MembershipStatus.options);
export const themeChoice = pgEnum('theme_choice', ThemeChoice.options);

/**
 * A person's membership in one school (spec 04, Identity) [T][S]. The person is the global
 * `accounts` row; this row holds what the school knows about them. `unique (tenant_id, id)` is
 * the target of the composite foreign keys from other tenant tables and `sessions` (D23).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    kind: membershipKind('kind').notNull(),
    name: text('name').notNull(),
    /** The address the school knows; sign-in uses `accounts.email`. */
    email: citext('email'),
    phoneE164: text('phone_e164'),
    /** References files(id) once files exist (M4). */
    avatarFileId: uuid('avatar_file_id'),
    status: membershipStatus('status').notNull().default('invited'),
    /** BCP 47; null means the school's locale. */
    locale: text('locale'),
    theme: themeChoice('theme').notNull().default('system'),
    lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
    /**
     * When the latest staff invitation was sent (Task 13, D32): an invite link signed before it
     * is refused, so Resend invite retires the old link, and the list shows "Invite sent …".
     */
    inviteSentAt: timestamp('invite_sent_at', { withTimezone: true }),
    /**
     * The nonce of the one staff invite link that may still be used (Task 13 fix round 1, M1):
     * Resend replaces it, so only the newest link works; null once accepted or deactivated.
     */
    inviteNonce: text('invite_nonce'),
    /**
     * When the membership was accepted (Task 13 fix round 1, I1): set by accepting the invitation.
     * Reactivating one that never was puts it back to `invited`, never `active`.
     */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    unique('users_tenant_id_id_unique').on(table.tenantId, table.id),
    unique('users_tenant_id_account_id_unique').on(table.tenantId, table.accountId),
    index('users_tenant_id_kind_status_idx').on(table.tenantId, table.kind, table.status),
    index('users_tenant_id_email_idx').on(table.tenantId, table.email),
    // auth_memberships(account_id) looks up every school of one account (spec 04, D16).
    index('users_account_id_idx').on(table.accountId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
