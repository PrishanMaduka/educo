import { LeadKind, LeadSource, LeadStatus, StudentsBand } from '@quad/contracts';
import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { uuidv7 } from '../../uuid';
import { bytea, citext } from '../types';

import { platformUsers } from './platform-users';
import { tenants } from './tenants';

export const leadKind = pgEnum('lead_kind', LeadKind.options);
export const leadSource = pgEnum('lead_source', LeadSource.options);
export const leadStatus = pgEnum('lead_status', LeadStatus.options);
export const studentsBand = pgEnum('students_band', StudentsBand.options);

/**
 * Demo requests and parents' "tell my school" requests from the landing page (spec 04, Platform;
 * spec 19, Demo requests; D57). Platform table: no tenant_id, closed to `quad_app`. The public
 * endpoint writes it only through the security-definer function `record_demo_request` (D16);
 * the console reads it through `withPlatform` (M2).
 */
export const platformLeads = pgTable(
  'platform_leads',
  {
    id: uuid('id').primaryKey().defaultRandom().$defaultFn(uuidv7),
    kind: leadKind('kind').notNull(),
    name: text('name').notNull(),
    /** citext, so a repeat from the same address in another case finds the lead (D57). */
    email: citext('email').notNull(),
    schoolName: text('school_name').notNull(),
    /** Null for a parent's lead. */
    studentsBand: studentsBand('students_band'),
    curriculum: text('curriculum'),
    country: text('country'),
    /** A parent's city. */
    city: text('city'),
    /** A parent's note, at most 1,000 characters. */
    note: text('note'),
    source: leadSource('source').notNull().default('landing'),
    status: leadStatus('status').notNull().default('new'),
    ownerPlatformUserId: uuid('owner_platform_user_id').references(() => platformUsers.id),
    /** Quad's team's notes; the per-note table `platform_lead_notes` comes with M2's Leads. */
    notes: text('notes'),
    convertedTenantId: uuid('converted_tenant_id').references(() => tenants.id),
    /** A keyed SHA-256 of the requester's IP address, for abuse checks; never the address. */
    ipHash: bytea('ip_hash').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set on every repeat within 24 hours; retention counts 24 months from it (spec 19). */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The 24-hour repeat match in record_demo_request.
    index('platform_leads_email_kind_created_at_idx').on(
      table.email,
      table.kind,
      table.createdAt.desc(),
    ),
    // M2's Leads list.
    index('platform_leads_status_updated_at_idx').on(table.status, table.updatedAt.desc()),
    // M2's retention job (OQ-T3).
    index('platform_leads_updated_at_idx').on(table.updatedAt),
    index('platform_leads_owner_platform_user_id_idx').on(table.ownerPlatformUserId),
    index('platform_leads_converted_tenant_id_idx').on(table.convertedTenantId),
    check('platform_leads_name_length', sql`char_length(${table.name}) BETWEEN 1 AND 120`),
    check('platform_leads_email_length', sql`char_length(${table.email}) <= 254`),
    check(
      'platform_leads_school_name_length',
      sql`char_length(${table.schoolName}) BETWEEN 1 AND 120`,
    ),
    check('platform_leads_curriculum_length', sql`char_length(${table.curriculum}) <= 40`),
    check('platform_leads_country_length', sql`char_length(${table.country}) <= 80`),
    check('platform_leads_city_length', sql`char_length(${table.city}) <= 80`),
    check('platform_leads_note_length', sql`char_length(${table.note}) <= 1000`),
    check('platform_leads_ip_hash_length', sql`octet_length(${table.ipHash}) = 32`),
    check('platform_leads_user_agent_length', sql`char_length(${table.userAgent}) <= 400`),
  ],
);

export type PlatformLead = typeof platformLeads.$inferSelect;
