import { createTestDatabase } from '@quad/db/testing';
import { afterAll, beforeAll } from 'vitest';

import { useTestApp } from '../app';

import type { TestAppOptions } from '../app';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { TestDatabase } from '@quad/db/testing';

/**
 * A fresh migrated database for this test file and the real app on it (registered in that
 * order, so the app closes its pools before the database is dropped).
 */
export function useDatabaseApp(
  env: Record<string, string | undefined> = {},
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
    () => ({ DATABASE_URL: db().appUrl, DATABASE_PLATFORM_URL: db().platformUrl, ...env }),
    options,
  );
  return { db, app };
}
