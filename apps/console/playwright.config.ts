import { devices, type PlaywrightTestConfig } from '@playwright/test';
import { defineWebAppConfig } from '@quad/config/playwright';

import type { StackOptions } from '@quad/config/playwright/stack';

const base = defineWebAppConfig({ port: 3001, stack: true });

/**
 * The WebKit project (D27), as the staff portal has it: the journeys tagged `@webkit` (console
 * sign-in and drawer focus) in Safari's engine at 1440×900, light. It runs in CI only
 * (`QUAD_E2E_WEBKIT=1`, with `playwright install webkit`); without the flag it is left out.
 */
const webkit: NonNullable<PlaywrightTestConfig<StackOptions>['projects']> =
  process.env.QUAD_E2E_WEBKIT === '1'
    ? [
        {
          name: 'webkit-desktop-light',
          grep: /@webkit/,
          use: {
            ...devices['Desktop Safari'],
            viewport: { width: 1440, height: 900 },
            colorScheme: 'light',
          },
        },
      ]
    : [];

// The console journeys need the API: the e2e stack (Task 18) starts first, on :4000, then the
// owner signs in once for the journeys that only read (Task 23). Turbo runs this after the staff
// portal's e2e, whose stack also takes :4000.
export default {
  ...base,
  projects: [...(base.projects ?? []), ...webkit],
  globalSetup: './e2e/global-sign-in.ts',
} satisfies PlaywrightTestConfig<StackOptions>;
