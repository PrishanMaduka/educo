import { vitestPreset } from '@quad/config/vitest';
import { defineConfig } from 'vitest/config';

/** Unit tests for the repository scripts. `*.api.test.ts` need the compose services (`test:api`). */
export default defineConfig({
  ...vitestPreset,
  test: {
    ...vitestPreset.test,
    name: 'scripts',
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.api.test.ts'],
  },
});
