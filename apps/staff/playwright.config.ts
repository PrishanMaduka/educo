import { devices, type PlaywrightTestConfig } from '@playwright/test';
import { defineWebAppConfig } from '@quad/config/playwright';

import type { StackOptions } from '@quad/config/playwright/stack';

const base = defineWebAppConfig({ port: 3000, stack: true });

/**
 * The WebKit project (D27): the journeys tagged `@webkit` (drawer and menu focus, and the session
 * cookie journeys: sign-in, an expired session, sign-out) in Safari's engine at 1440×900, light.
 * Local session cookies have no `Secure` because WebKit drops Secure cookies on http://localhost
 * (D32), and this project is what proves the portal still works there. It runs in CI only
 * (`QUAD_E2E_WEBKIT=1`, with `playwright install webkit`); without the flag it is left out, so a
 * machine without WebKit runs the Chromium projects as before.
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

// The sign-in and shell journeys need the API: the e2e stack (Task 18) starts first, on :4000,
// then Prishan signs in once for the shell journeys that only read (Task 20).
export default {
  ...base,
  projects: [...(base.projects ?? []), ...webkit],
  globalSetup: './e2e/global-sign-in.ts',
} satisfies PlaywrightTestConfig<StackOptions>;
