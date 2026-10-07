import { defineConfig } from 'vitest/config';

/** Root projects: every package or app with its own Vitest config, including the repo scripts. */
export default defineConfig({
  test: {
    allowOnly: false,
    projects: [
      'scripts/vitest.config.ts',
      'packages/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
    ],
  },
});
