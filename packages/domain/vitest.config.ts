import { vitestPreset } from '@quad/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  vitestPreset,
  defineConfig({
    test: {
      coverage: {
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/index.ts'],
        thresholds: {
          branches: 100,
        },
      },
    },
  }),
);
