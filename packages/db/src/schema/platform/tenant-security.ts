import { TwoStepRule } from '@quad/contracts';
import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { citext } from '../types';

import { tenants } from './tenants';

export const twoStepRule = pgEnum('two_step_rule', TwoStepRule.options);

/**
 * A school's sign-in rules, managed by Quad (spec 04, Platform; spec 05; spec 08 shows them
 * read-only).
 */
export const tenantSecurity = pgTable(
  'tenant_security',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id),
    ssoGoogle: boolean('sso_google').notNull().default(false),
    ssoMicrosoft: boolean('sso_microsoft').notNull().default(false),
    /** The email domain SSO accepts, for example `colombo-intl.lk`. */
    ssoDomain: citext('sso_domain'),
    twoStep: twoStepRule('two_step').notNull().default('off'),
    /** At least 10 (spec 05); the school can ask for more. */
    passwordMinLength: integer('password_min_length').notNull().default(10),
    /** Idle timeout for staff sessions (spec 05: default 12 hours). */
    sessionHours: integer('session_hours').notNull().default(12),
    ipAllowlist: text('ip_allowlist')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (table) => [
    check('tenant_security_password_min_length', sql`${table.passwordMinLength} >= 10`),
    check('tenant_security_session_hours', sql`${table.sessionHours} > 0`),
  ],
);

export type TenantSecurity = typeof tenantSecurity.$inferSelect;
