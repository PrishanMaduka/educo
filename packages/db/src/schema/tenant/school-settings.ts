import {
  AbsenceAlertMode,
  EarlyWarningSharing,
  PhotoConsent,
  SmsSenderStatus,
} from '@quad/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { tenants } from '../platform/tenants';
import { citext } from '../types';

import { users } from './users';

export const earlyWarningSharing = pgEnum('early_warning_sharing', EarlyWarningSharing.options);
export const absenceAlertMode = pgEnum('absence_alert_mode', AbsenceAlertMode.options);
export const photoConsent = pgEnum('photo_consent', PhotoConsent.options);
export const smsSenderStatus = pgEnum('sms_sender_status', SmsSenderStatus.options);

/**
 * One school's settings (spec 04, Identity; spec 08, School settings) [T]. The defaults are the
 * spec's: alerts at 09:00, reminders 3 days before and 7 and 14 after, quiet hours 18:00–07:00
 * and weekends, share early warning after a plan is started, photo consent `class`.
 */
export const schoolSettings = pgTable(
  'school_settings',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id),
    /** Reply-To on the school's emails. */
    officeEmail: citext('office_email'),
    officePhone: text('office_phone'),
    /** Spec 08 General lists it; spec 04 has no column for it (D32). */
    address: text('address'),
    askQuadEnabled: boolean('ask_quad_enabled').notNull().default(true),
    askQuadKeepConversations: boolean('ask_quad_keep_conversations').notNull().default(true),
    ewShareWithParents: earlyWarningSharing('ew_share_with_parents')
      .notNull()
      .default('after_plan'),
    absenceAlert: absenceAlertMode('absence_alert').notNull().default('at_time'),
    /** School-local `HH:mm`. */
    absenceAlertTime: time('absence_alert_time').notNull().default('09:00'),
    /** Days relative to the due date: negative is before. */
    reminderDays: integer('reminder_days')
      .array()
      .notNull()
      .default(sql`'{-3,7,14}'::integer[]`),
    photoConsentDefault: photoConsent('photo_consent_default').notNull().default('class'),
    familyCircleEnabled: boolean('family_circle_enabled').notNull().default(true),
    quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(true),
    /** School-local `HH:mm`. */
    quietFrom: time('quiet_from').notNull().default('18:00'),
    /** School-local `HH:mm`. */
    quietUntil: time('quiet_until').notNull().default('07:00'),
    quietWeekends: boolean('quiet_weekends').notNull().default(true),
    /** The school's own SMS sender ID; messages go as "QUAD" until it is approved. */
    smsSenderId: text('sms_sender_id'),
    /** Null when the school has not asked for its own sender ID. */
    smsSenderStatus: smsSenderStatus('sms_sender_status'),
    updatedBy: uuid('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: 'school_settings_tenant_id_updated_by_users_fk',
      columns: [table.tenantId, table.updatedBy],
      foreignColumns: [users.tenantId, users.id],
    }),
  ],
);

export type SchoolSettings = typeof schoolSettings.$inferSelect;
export type NewSchoolSettings = typeof schoolSettings.$inferInsert;
