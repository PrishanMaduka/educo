import { vitestPreset } from '@quad/config/vitest';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests only (`pnpm test`): pure code in src, no database. `include` replaces the preset's
 * (mergeConfig would concatenate it and pull in the database tests).
 */
export default defineConfig({
  ...vitestPreset,
  test: {
    ...vitestPreset.test,
    name: 'db',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/internal.ts',
        'src/testing.ts',
        'src/scripts/**',
      ],
    },
  },
});
