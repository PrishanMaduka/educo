import { sql } from 'drizzle-orm';
import { bigint, boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { accounts } from './accounts';

/**
 * One password and one authenticator for all of a person's schools (spec 04, Identity).
 * Account table keyed on `account_id`.
 */
export const credentials = pgTable('credentials', {
  accountId: uuid('account_id')
    .primaryKey()
    .references(() => accounts.id),
  /** Argon2id; null for people who sign in only by SSO or OTP. */
  passwordHash: text('password_hash'),
  /** Encrypted with the field cipher. */
  totpSecretEnc: text('totp_secret_enc'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  /**
   * The last authenticator time step accepted (RFC 6238 §5.2: a code is never accepted twice);
   * only a later step is accepted next.
   */
  totpLastStep: bigint('totp_last_step', { mode: 'number' }),
  recoveryCodesHash: text('recovery_codes_hash')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
});

export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
