import { Injectable } from '@nestjs/common';
import { IdSchema } from '@quad/contracts';
import { and, eq, isNull, ne, sql, tenantBranding, tenants } from '@quad/db';
import { z } from 'zod';

import type { TenantStatus } from '@quad/contracts';
import type { PlatformTx, SQL } from '@quad/db';

/** A `GET /platform/tenants` cursor: the last school's lower-cased name and id. */
export const NameKeyset = z.object({ name: z.string().max(1000), id: IdSchema });
export type NameKeyset = z.infer<typeof NameKeyset>;

/** A school as the console's list shows it. */
export interface PlatformTenantRow {
  readonly id: string;
  readonly name: string;
  /** `name` lower-cased, for the next page's keyset. */
  readonly sortName: string;
  readonly shortName: string;
  readonly status: TenantStatus;
  readonly brandColor: string | null;
}

/** Schools that still exist: never a deleted one, in the list or for a support visit. */
const live = and(ne(tenants.status, 'deleted'), isNull(tenants.deletedAt));

/** By name, case-blind and in code-point order, so every page boundary is exact. */
const SORT_NAME = sql<string>`lower(${tenants.name}) collate "C"`;

/** Reads `tenants` for the console (`withPlatform` only). */
@Injectable()
export class TenantsRepository {
  /** Up to `limit + 1` live schools after `after`, by name then id. */
  async page(
    tx: PlatformTx,
    after: NameKeyset | null,
    limit: number,
  ): Promise<PlatformTenantRow[]> {
    const afterKey: SQL | undefined =
      after === null
        ? undefined
        : sql`(${SORT_NAME}, ${tenants.id}) > (${after.name} collate "C", ${after.id}::uuid)`;
    return tx
      .select({
        id: tenants.id,
        name: tenants.name,
        sortName: sql<string>`lower(${tenants.name})`,
        shortName: tenants.shortName,
        status: tenants.status,
        brandColor: tenantBranding.brandColor,
      })
      .from(tenants)
      .leftJoin(tenantBranding, eq(tenantBranding.tenantId, tenants.id))
      .where(and(live, afterKey))
      .orderBy(SORT_NAME, tenants.id)
      .limit(limit + 1);
  }

  /** The id of a school that still exists, or null (unknown or deleted). */
  async liveTenantId(tx: PlatformTx, tenantId: string): Promise<string | null> {
    const [row] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(eq(tenants.id, tenantId), live));
    return row?.id ?? null;
  }
}
