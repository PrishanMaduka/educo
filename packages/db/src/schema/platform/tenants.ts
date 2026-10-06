import { SchoolHealthLevel, TenantRegion, TenantStatus } from '@quad/contracts';
import {
  char,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';

export const tenantRegion = pgEnum('tenant_region', TenantRegion.options);
export const tenantStatus = pgEnum('tenant_status', TenantStatus.options);
export const schoolHealthLevel = pgEnum('school_health_level', SchoolHealthLevel.options);

/**
 * A school (spec 04, Platform). Platform table: no tenant_id and no RLS policy; reached only
 * through `withPlatform()` and the named security-definer lookups (spec 02, D16).
 */
export const tenants = pgTable('tenants', {
  /** UUID v7 generated in TypeScript; the database default is a fallback for hand-written SQL. */
  id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
  name: text('name').notNull(),
  shortName: varchar('short_name', { length: 4 }).notNull(),
  /** Internal reference for support, search and exports; never used for routing. */
  slug: text('slug').notNull().unique(),
  /** ISO 3166-1 alpha-2. */
  country: char('country', { length: 2 }).notNull(),
  region: tenantRegion('region').notNull().default('ap-south'),
  /** IANA time zone, for example Asia/Colombo. */
  timeZone: text('time_zone').notNull(),
  /** ISO 4217, for example LKR. */
  currency: char('currency', { length: 3 }).notNull(),
  /** BCP 47, for example en-LK. */
  locale: text('locale').notNull(),
  status: tenantStatus('status').notNull().default('trial'),
  /** References plans(id) once plans exist (M2). */
  planId: uuid('plan_id'),
  seatLimit: integer('seat_limit'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  /** References curriculum_templates(id) once they exist (M2). */
  curriculumTemplateId: uuid('curriculum_template_id'),
  /** The date the school became a customer. */
  since: date('since'),
  healthOverride: schoolHealthLevel('health_override'),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  /** Shown to the school's admins. */
  suspendReason: text('suspend_reason'),
  deletionScheduledFor: timestamp('deletion_scheduled_for', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
