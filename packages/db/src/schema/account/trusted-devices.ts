import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { bytea } from '../types';

import { accounts } from './accounts';

/**
 * "Trust this device for 30 days" after two-step (spec 05). Account table keyed on
 * `account_id`.
 */
export const trustedDevices = pgTable(
  'trusted_devices',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    /** SHA-256 of the trusted-device cookie. */
    tokenHash: bytea('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('trusted_devices_account_id_idx').on(table.accountId)],
);

export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type NewTrustedDevice = typeof trustedDevices.$inferInsert;
