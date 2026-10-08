import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants';

/**
 * A school's logo and colour (spec 04, Platform). Platform table: school code reads it through
 * a security-definer function (D24), never with a grant.
 */
export const tenantBranding = pgTable('tenant_branding', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id),
  /** `#rrggbb`. */
  brandColor: text('brand_color'),
  /** References files(id) once files exist. */
  logoFileId: uuid('logo_file_id'),
  accentMode: text('accent_mode'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});

export type TenantBranding = typeof tenantBranding.$inferSelect;
