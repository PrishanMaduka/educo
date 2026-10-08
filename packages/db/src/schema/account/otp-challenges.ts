import { OtpChannel } from '@quad/contracts';
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { bytea } from '../types';

export const otpChannel = pgEnum('otp_channel', OtpChannel.options);

/**
 * A one-time code sent by SMS or email (spec 04, Identity; spec 05, Parent app). Open table (D32):
 * there is no account until the code is verified, so it has no RLS. Nothing in it identifies a
 * person without the server key: `subject_hash` is HMAC-SHA256 of the normalised phone or email
 * and `code_hash` is HMAC-SHA256 over (challenge id, code), both keyed by HKDF-SHA256 from
 * `SESSION_SECRET`.
 */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    subjectHash: bytea('subject_hash').notNull(),
    channel: otpChannel('channel').notNull(),
    codeHash: bytea('code_hash').notNull(),
    /** What the code is for, for example `sign_in`. */
    purpose: text('purpose').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('otp_challenges_subject_hash_created_at_idx').on(
      table.subjectHash,
      table.createdAt.desc(),
    ),
  ],
);

export type OtpChallenge = typeof otpChallenges.$inferSelect;
export type NewOtpChallenge = typeof otpChallenges.$inferInsert;
