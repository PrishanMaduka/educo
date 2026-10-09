import { defineWebAppConfig } from '@quad/config/playwright';

// The sign-in journeys need the API: the e2e stack (Task 18) starts first, on :4000.
export default defineWebAppConfig({ port: 3000, stack: true });
