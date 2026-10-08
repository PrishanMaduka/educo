import { vitestPreset } from '@quad/config/vitest';
import { defineConfig } from 'vitest/config';

/** Checks against the compose services (`pnpm test:api`). */
export default defineConfig({
  ...vitestPreset,
  test: {
    ...vitestPreset.test,
    name: 'scripts-integration',
    include: ['test/**/*.api.test.ts'],
  },
});
