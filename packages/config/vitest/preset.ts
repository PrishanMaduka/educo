import { defineConfig } from 'vitest/config';

/** Shared Vitest settings. Packages call `defineConfig(mergeConfig(preset, {...}))` or use it directly. */
export const vitestPreset = defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov'],
    },
  },
});

export default vitestPreset;
