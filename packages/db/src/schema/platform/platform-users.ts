import { AccountStatus, PlatformRole } from '@quad/contracts';
import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { citext } from '../types';

export const platformRole = pgEnum('platform_role', PlatformRole.options);

/**
 * The account status enum. Created with the platform tables (0003) because `platform_users`
 * uses it too; `accounts.status` (0004) reuses it.
 */
export const accountStatus = pgEnum('account_status', AccountStatus.options);

/**
 * A Quad staff member who signs in to the console (spec 04, Platform; spec 05, Platform
 * console). Platform table: closed to `quad_app`.
 */
export const platformUsers = pgTable('platform_users', {
  id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
  name: text('name').notNull(),
  /** `@quad-edu.com` in production (spec 07, Platform users). */
  email: citext('email').notNull().unique(),
  role: platformRole('role').notNull(),
  /** Encrypted with the field cipher; null until the person sets up TOTP. */
  totpSecretEnc: text('totp_secret_enc'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  /** Argon2id. Used only when `CONSOLE_PASSWORD_LOGIN=true` (local, dev, staging; D22). */
  passwordHash: text('password_hash'),
  status: accountStatus('status').notNull().default('active'),
  lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PlatformUser = typeof platformUsers.$inferSelect;
export type NewPlatformUser = typeof platformUsers.$inferInsert;
