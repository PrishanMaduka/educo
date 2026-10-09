import { createTestDatabase } from '@quad/db/testing';
import { afterAll, beforeAll } from 'vitest';

import { useTestApp } from '../app';

import type { TestAppOptions } from '../app';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { TestDatabase } from '@quad/db/testing';

type Env = Record<string, string | undefined>;

/**
 * A fresh migrated database for this test file and the real app on it (registered in that
 * order, so the app closes its pools before the database is dropped). `env` may be a function
 * when a value only exists once an earlier `beforeAll` has run (a fake server's URL).
 */
export function useDatabaseApp(
  env: Env | (() => Env) = {},
  options: TestAppOptions = {},
): { db: () => TestDatabase; app: () => NestFastifyApplication } {
  let database: TestDatabase | undefined;
  const db = (): TestDatabase => {
    if (!database) throw new Error('The test database is not ready.');
    return database;
  };
  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database?.drop();
  });
  const app = useTestApp(
    () => ({
      DATABASE_URL: db().appUrl,
      DATABASE_PLATFORM_URL: db().platformUrl,
      ...(typeof env === 'function' ? env() : env),
    }),
    options,
  );
  return { db, app };
}
