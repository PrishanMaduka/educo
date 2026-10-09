import { defineWebAppConfig } from '@quad/config/playwright';

// The sign-in and shell journeys need the API: the e2e stack (Task 18) starts first, on :4000,
// then Prishan signs in once for the shell journeys that only read (Task 20).
export default {
  ...defineWebAppConfig({ port: 3000, stack: true }),
  globalSetup: './e2e/global-sign-in.ts',
};
