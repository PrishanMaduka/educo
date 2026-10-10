import { Inject, Injectable } from '@nestjs/common';
import { resolveBrandColour } from '@quad/tokens';

import { decodeCursor, pageOf } from '../../common/pagination/cursor';
import { PLATFORM_DB } from '../tokens';

import { NameKeyset, TenantsRepository } from './tenants.repository';

import type { PlatformTenantRow } from './tenants.repository';
import type { PlatformTenant, PlatformTenantList, PlatformTenantListQuery } from '@quad/contracts';
import type { QuadPlatformDb } from '@quad/db';

function toPlatformTenant(row: PlatformTenantRow): PlatformTenant {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    status: row.status,
    // The colour the school's portal uses (D56): Quad lime for none, an invalid or a legacy one.
    brandColor: resolveBrandColour(row.brandColor),
  };
}

/**
 * The console's school list (spec 06 `GET /platform/tenants`; spec 07 Schools). Minimal in M1:
 * id, names, status and colour, so the console can pick a school to support; M2 extends it.
 */
@Injectable()
export class TenantsService {
  constructor(
    @Inject(PLATFORM_DB) private readonly db: QuadPlatformDb,
    private readonly repository: TenantsRepository,
  ) {}

  list(query: PlatformTenantListQuery): Promise<PlatformTenantList> {
    const after = decodeCursor(NameKeyset, query.cursor);
    return this.db.withPlatform(async (tx) => {
      const rows = await this.repository.page(tx, after, query.limit);
      const page = pageOf(rows, query.limit, (last) => ({ name: last.sortName, id: last.id }));
      return { items: page.items.map(toPlatformTenant), nextCursor: page.nextCursor };
    });
  }
}
