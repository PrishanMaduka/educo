import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { accountStatus } from '../platform/platform-users';
import { citext } from '../types';

/**
 * One person across every school (spec 04, Identity). Account table: no tenant_id; RLS keys on
 * `id = app.account_id` (D32), so `quad_app` sees only the account `withAccount` names.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    email: citext('email').unique(),
    phoneE164: text('phone_e164').unique(),
    status: accountStatus('status').notNull().default('active'),
    /** Set by the lockout rule (spec 05: five failures in 15 minutes lock it for 15 minutes). */
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'accounts_email_or_phone',
      sql`${table.email} IS NOT NULL OR ${table.phoneE164} IS NOT NULL`,
    ),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
