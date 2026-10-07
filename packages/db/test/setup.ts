import { afterAll, beforeAll } from 'vitest';

import { createTestDatabase } from '../src/testing';

import type { TestDatabase } from '../src/testing';

export type { TestDatabase } from '../src/testing';

/**
 * Registers hooks that create a fresh, migrated database for one test file (`createTestDatabase`)
 * and drop it afterwards. Call at the top level of a test file and read the returned getter
 * inside tests.
 */
export function useTestDatabase(): () => TestDatabase {
  let state: TestDatabase | undefined;

  beforeAll(async () => {
    state = await createTestDatabase();
  });

  afterAll(async () => {
    await state?.drop();
  });

  return () => {
    if (!state) {
      throw new Error('The test database is not ready; read it inside a test or hook.');
    }
    return state;
  };
}
