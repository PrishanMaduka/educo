import { randomBytes } from 'node:crypto';

import pg from 'pg';

import { databaseUrls, withDatabaseName } from './env';
import { runMigrations } from './migrate';

/**
 * Test-only database helpers (`@quad/db/testing`). ESLint (`quad/no-raw-db-client`) allows this
 * entry only in test folders and inside packages/db: it hands out raw pools for every role.
 */

/** A fresh, migrated database with a pool per role. */
export interface TestDatabase {
  readonly name: string;
  readonly appUrl: string;
  readonly platformUrl: string;
  readonly ownerUrl: string;
  /** `quad_app` (NOBYPASSRLS). One connection, so pooled-connection reuse is deterministic. */
  readonly app: pg.Pool;
  /** `quad_platform` (BYPASSRLS). */
  readonly platform: pg.Pool;
  /** `quad_owner` (owns the schema, still filtered by FORCE RLS). */
  readonly owner: pg.Pool;
  /** Ends the pools and drops the database. */
  drop(): Promise<void>;
}

async function asOwnerOfCluster(sql: readonly string[]): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrls().ownerUrl });
  await client.connect();
  try {
    for (const statement of sql) {
      await client.query(statement);
    }
  } finally {
    await client.end();
  }
}

/**
 * Creates `quad_test_<random>` as `quad_owner` (CREATEDB), lets only the three Quad roles
 * connect, and runs the migrations into it as `quad_owner`.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `quad_test_${randomBytes(6).toString('hex')}`;
  await asOwnerOfCluster([
    `create database ${name}`,
    `revoke all on database ${name} from public`,
    `grant connect on database ${name} to quad_owner, quad_app, quad_platform`,
  ]);
  const base = databaseUrls();
  const appUrl = withDatabaseName(base.appUrl, name);
  const platformUrl = withDatabaseName(base.platformUrl, name);
  const ownerUrl = withDatabaseName(base.ownerUrl, name);
  try {
    await runMigrations(ownerUrl);
  } catch (error) {
    await asOwnerOfCluster([`drop database if exists ${name}`]);
    throw error;
  }
  const app = new pg.Pool({ connectionString: appUrl, max: 1 });
  const platform = new pg.Pool({ connectionString: platformUrl, max: 2 });
  const owner = new pg.Pool({ connectionString: ownerUrl, max: 2 });
  return {
    name,
    appUrl,
    platformUrl,
    ownerUrl,
    app,
    platform,
    owner,
    drop: async () => {
      await Promise.all([app.end(), platform.end(), owner.end()]);
      // Close any app built on this database first: quad_owner cannot end other roles' sessions.
      await asOwnerOfCluster([`drop database if exists ${name}`]);
    },
  };
}
