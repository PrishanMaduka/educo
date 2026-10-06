import { defineConfig } from 'vitest/config';

/** Root projects: repo-level checks plus every package or app with its own Vitest config. */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'repo',
          environment: 'node',
          include: ['scripts/test/**/*.test.ts'],
        },
      },
      'packages/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
    ],
  },
});
