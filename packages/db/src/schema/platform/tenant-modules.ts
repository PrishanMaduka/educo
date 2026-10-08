import { PlanModule } from '@quad/contracts';
import { boolean, pgEnum, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants';

export const planModule = pgEnum('plan_module', PlanModule.options);

/** Which plan modules a school has on (spec 04, Platform; spec 05, Plan and module guard). */
export const tenantModules = pgTable(
  'tenant_modules',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    module: planModule('module').notNull(),
    enabled: boolean('enabled').notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.module] })],
);

export type TenantModule = typeof tenantModules.$inferSelect;
