import { vitestPreset } from '@quad/config/vitest';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/** Integration tests (`pnpm test:api`): need the compose Postgres and Redis. */
export default defineConfig({
  ...vitestPreset,
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    ...vitestPreset.test,
    name: 'api-integration',
    include: ['test/**/*.api.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
