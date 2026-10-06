import { randomBytes } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll } from 'vitest';

import { databaseUrls, runMigrations, withDatabaseName } from '../src/internal';

/** A fresh, migrated database for one test file, with a pool per role. */
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
 * Registers hooks that create `quad_test_<random>` as `quad_owner` (CREATEDB), run the
 * migrations into it as `quad_owner`, and drop it after the file. Call at the top level of a
 * test file and read the returned getter inside tests.
 */
export function useTestDatabase(): () => TestDatabase {
  const name = `quad_test_${randomBytes(6).toString('hex')}`;
  let state: TestDatabase | undefined;

  beforeAll(async () => {
    await asOwnerOfCluster([
      `create database ${name}`,
      `revoke all on database ${name} from public`,
      `grant connect on database ${name} to quad_owner, quad_app, quad_platform`,
    ]);
    const base = databaseUrls();
    const appUrl = withDatabaseName(base.appUrl, name);
    const platformUrl = withDatabaseName(base.platformUrl, name);
    const ownerUrl = withDatabaseName(base.ownerUrl, name);
    await runMigrations(ownerUrl);
    state = {
      name,
      appUrl,
      platformUrl,
      ownerUrl,
      app: new pg.Pool({ connectionString: appUrl, max: 1 }),
      platform: new pg.Pool({ connectionString: platformUrl, max: 2 }),
      owner: new pg.Pool({ connectionString: ownerUrl, max: 2 }),
    };
  });

  afterAll(async () => {
    if (state) {
      await Promise.all([state.app.end(), state.platform.end(), state.owner.end()]);
    }
    await asOwnerOfCluster([`drop database if exists ${name}`]);
  });

  return () => {
    if (!state) {
      throw new Error('The test database is not ready; read it inside a test or hook.');
    }
    return state;
  };
}
