import { defineWebAppConfig } from '@quad/config/playwright';

import type { PlaywrightTestConfig } from '@playwright/test';

// The landing and public-page journeys against the pre-launch static export (site-export/out, built by
// `pnpm build:export`), served the way GitHub Pages serves it.
const PORT = 3002;
const base = defineWebAppConfig({ port: PORT });

const config: PlaywrightTestConfig = {
  ...base,
  testMatch: ['landing.spec.ts', 'public-pages.spec.ts'],
  outputDir: 'test-results/export',
  projects: (base.projects ?? []).map((project) => ({
    ...project,
    name: `export-${project.name ?? ''}`,
    metadata: { prelaunch: true },
  })),
  webServer: {
    command: `node scripts/serve-export.mjs ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
};

export default config;
