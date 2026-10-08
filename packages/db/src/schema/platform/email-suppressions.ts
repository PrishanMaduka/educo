import { EmailSuppressionReason } from '@quad/contracts';
import { sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { citext } from '../types';

export const emailSuppressionReason = pgEnum(
  'email_suppression_reason',
  EmailSuppressionReason.options,
);

/**
 * Addresses Quad must not email (spec 04, Platform; spec 20, Email). Platform table: no
 * tenant_id, closed to `quad_app`. The SES webhook writes it through the security-definer
 * function `record_email_suppression` (D16), never with a grant.
 */
export const emailSuppressions = pgTable(
  'email_suppressions',
  {
    /** At most 320 characters, one `@`, no whitespace (the checks below). */
    address: citext('address').primaryKey(),
    reason: emailSuppressionReason('reason').notNull(),
    /** Where the suppression came from, for example `ses` (1 to 64 characters). */
    source: text('source').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('email_suppressions_address_length', sql`char_length(${table.address}) <= 320`),
    check('email_suppressions_address_shape', sql`${table.address}::text ~ '^[^@\\s]+@[^@\\s]+$'`),
    check('email_suppressions_source_length', sql`char_length(${table.source}) BETWEEN 1 AND 64`),
  ],
);

export type EmailSuppression = typeof emailSuppressions.$inferSelect;
