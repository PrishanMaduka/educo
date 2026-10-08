import { vitestPreset } from '@quad/config/vitest';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests (`pnpm test`): no Postgres or Redis needed. Files named `*.api.test.ts` need the
 * compose services and run under `pnpm test:api` instead.
 *
 * SWC replaces esbuild for transforming TypeScript because Nest's dependency injection reads
 * the `design:paramtypes` metadata that only `emitDecoratorMetadata` produces.
 */
export default defineConfig({
  ...vitestPreset,
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    ...vitestPreset.test,
    name: 'api',
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.api.test.ts'],
  },
});
