import { fileURLToPath } from 'node:url';

import { vitestPreset } from '@quad/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  vitestPreset,
  defineConfig({
    // Next's tsconfig keeps JSX for its own compiler; tests use the automatic runtime.
    esbuild: { jsx: 'automatic' },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      css: false,
      testTimeout: 15_000,
    },
  }),
);
