import { SsoProvider } from '@quad/contracts';
import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { citext } from '../types';

import { accounts } from './accounts';

export const ssoProvider = pgEnum('sso_provider', SsoProvider.options);

/**
 * An SSO login linked to an account on its first SSO sign-in (spec 04, Identity; spec 05).
 * Account table keyed on `account_id`.
 */
export const identities = pgTable(
  'identities',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    provider: ssoProvider('provider').notNull(),
    /** The provider's stable subject (`sub`) for the person. */
    subject: text('subject').notNull(),
    email: citext('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('identities_provider_subject_unique').on(table.provider, table.subject),
    index('identities_account_id_idx').on(table.accountId),
  ],
);

export type Identity = typeof identities.$inferSelect;
export type NewIdentity = typeof identities.$inferInsert;
