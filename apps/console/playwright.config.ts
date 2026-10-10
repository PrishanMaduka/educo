import { fileURLToPath } from 'node:url';

import { devices, type PlaywrightTestConfig } from '@playwright/test';
import { defineWebAppConfig, nextStartServer } from '@quad/config/playwright';

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

/**
 * The staff portal's own build on :3000, against the same stack: the support visit journey
 * (Task 26) follows Open as school admin into the portal, sees the support banner and comes back
 * with Exit to platform. The API's links already point there (`PUBLIC_WEB_URL` and `CONSOLE_URL`
 * in `.env.example`). Turbo builds the portal first (`@quad/console#e2e`).
 */
const staffPortal = nextStartServer(3000, fileURLToPath(new URL('../staff', import.meta.url)));

// The console journeys need the API: the e2e stack (Task 18) starts first, on :4000, then the
// owner and Quad support sign in once for the journeys that only read or open a visit (Tasks 23
// and 26). Turbo runs this after the staff portal's e2e, whose stack and portal also take :4000
// and :3000.
export default {
  ...base,
  webServer: [...(Array.isArray(base.webServer) ? base.webServer : []), staffPortal],
  projects: [...(base.projects ?? []), ...webkit],
  globalSetup: './e2e/global-sign-in.ts',
} satisfies PlaywrightTestConfig<StackOptions>;
