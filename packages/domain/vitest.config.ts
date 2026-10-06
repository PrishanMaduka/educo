import { vitestPreset } from '@quad/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  vitestPreset,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          branches: 100,
        },
      },
    },
  }),
);
