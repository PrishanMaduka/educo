import { EmailSuppressionReason } from '@quad/contracts';
import { customType, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Case-insensitive text (the `citext` extension from the first migration). */
const citext = customType<{ data: string }>({ dataType: () => 'citext' });

export const emailSuppressionReason = pgEnum(
  'email_suppression_reason',
  EmailSuppressionReason.options,
);

/**
 * Addresses Quad must not email (spec 04, Platform; spec 20, Email). Platform table: no
 * tenant_id, closed to `quad_app`. The SES webhook writes it through the security-definer
 * function `record_email_suppression` (D16), never with a grant.
 */
export const emailSuppressions = pgTable('email_suppressions', {
  address: citext('address').primaryKey(),
  reason: emailSuppressionReason('reason').notNull(),
  /** Where the suppression came from, for example `ses`. */
  source: text('source').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export type EmailSuppression = typeof emailSuppressions.$inferSelect;
