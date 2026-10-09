import { Inject, Injectable } from '@nestjs/common';
import { HexColor } from '@quad/contracts';

import { decodeCursor, pageOf } from '../../common/pagination/cursor';
import { PLATFORM_DB } from '../tokens';

import { NameKeyset, TenantsRepository } from './tenants.repository';

import type { PlatformTenantRow } from './tenants.repository';
import type { PlatformTenant, PlatformTenantList, PlatformTenantListQuery } from '@quad/contracts';
import type { QuadPlatformDb } from '@quad/db';

function toPlatformTenant(row: PlatformTenantRow): PlatformTenant {
  // A colour stored in another shape is shown as none rather than failing the list.
  const brandColor = HexColor.safeParse(row.brandColor);
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    status: row.status,
    brandColor: brandColor.success ? brandColor.data : null,
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
