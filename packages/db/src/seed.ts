import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema';
import { SEED_TENANTS } from './seed-data';

/**
 * Upserts the seed data as `quad_owner`, in one transaction. Seeding is a deploy-time tool like
 * migrations, not a console action, so it does not go through `withPlatform` (whose writes
 * belong in `platform_audit`). Tenant tables seeded later must set `app.tenant_id` per school,
 * because FORCE RLS filters the owner too. Running it again restores the seed values.
 */
export async function seedDatabase(ownerUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: ownerUrl, application_name: 'quad-seed' });
  await client.connect();
  try {
    await drizzle({ client, schema }).transaction(async (tx) => {
      for (const tenant of Object.values(SEED_TENANTS)) {
        await tx
          .insert(schema.tenants)
          .values(tenant)
          .onConflictDoUpdate({
            target: schema.tenants.id,
            set: { ...tenant, updatedAt: sql`now()` },
          });
      }
    });
  } finally {
    await client.end();
  }
}
