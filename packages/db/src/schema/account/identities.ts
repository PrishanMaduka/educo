import { SsoProvider } from '@quad/contracts';
import { pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

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
    // One login per provider per account (0010, Task 8): two concurrent first sign-ins cannot
    // link two subjects. It also serves lookups by account, so the plain index went.
    unique('identities_account_id_provider_unique').on(table.accountId, table.provider),
  ],
);

export type Identity = typeof identities.$inferSelect;
export type NewIdentity = typeof identities.$inferInsert;
