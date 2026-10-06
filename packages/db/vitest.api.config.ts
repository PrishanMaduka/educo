import { vitestPreset } from '@quad/config/vitest';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests (`pnpm test:api`): run against the compose Postgres, and each test file
 * gets its own fresh database (test/setup.ts). `include` replaces the preset's.
 */
export default defineConfig({
  ...vitestPreset,
  test: {
    ...vitestPreset.test,
    name: 'db-api',
    include: ['test/**/*.test.ts'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
