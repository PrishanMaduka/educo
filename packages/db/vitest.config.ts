import { vitestPreset } from '@quad/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

/** Tests run against the compose Postgres; each test file gets its own fresh database. */
export default mergeConfig(
  vitestPreset,
  defineConfig({
    test: {
      name: 'db',
      hookTimeout: 60_000,
      testTimeout: 30_000,
      coverage: {
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/internal.ts', 'src/scripts/**'],
      },
    },
  }),
);
