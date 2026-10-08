import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/** Where `drizzle-kit generate` writes migrations. */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Applies pending migrations as `quad_owner` (spec 02, D17). Uses a single client, so the
 * migration transaction runs on one connection. Drizzle records applied migrations in
 * `drizzle.__drizzle_migrations`. The api image passes its own copy of the folder
 * (`dist/migrations`), because the package source is not shipped there.
 */
export async function runMigrations(
  ownerUrl: string,
  migrationsFolder: string = MIGRATIONS_FOLDER,
): Promise<void> {
  const client = new pg.Client({ connectionString: ownerUrl, application_name: 'quad-migrate' });
  await client.connect();
  try {
    await migrate(drizzle({ client }), { migrationsFolder });
  } finally {
    await client.end();
  }
}
