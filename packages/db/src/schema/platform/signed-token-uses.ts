import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Nonces of single-use signed tokens that have been used (spec 04, Platform; Tenant-less
 * lookups). Platform table: written only through a security-definer function (Task 3).
 */
export const signedTokenUses = pgTable('signed_token_uses', {
  nonce: text('nonce').primaryKey(),
  purpose: text('purpose').notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }).notNull().defaultNow(),
  /** The token's own expiry; the row can be purged after it. */
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export type SignedTokenUse = typeof signedTokenUses.$inferSelect;
