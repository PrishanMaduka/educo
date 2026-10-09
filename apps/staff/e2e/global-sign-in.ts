import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { request, type FullConfig } from '@playwright/test';

import { PEOPLE, PRISHAN_STATE, signInThroughApi } from './sign-in-as';

/**
 * Signs Prishan in once per run, after the stack and the app start, for the shell journeys that
 * only read (`test.use({ storageState: PRISHAN_STATE })`). One password call per run keeps well
 * inside the API's 10 per address in 15 minutes; journeys that change the session (sign out,
 * Switch school, a role preview) sign in on their own.
 */
export default async function globalSignIn(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (baseURL === undefined) throw new Error('The staff Playwright config has no baseURL.');
  const context = await request.newContext({
    baseURL,
    // Its own client address, apart from every test's (`clientAddressFor` uses 10.x.y.1–254).
    extraHTTPHeaders: { 'x-forwarded-for': '10.255.255.255' },
  });
  try {
    await signInThroughApi(context, PEOPLE.prishan);
    mkdirSync(dirname(PRISHAN_STATE), { recursive: true });
    await context.storageState({ path: PRISHAN_STATE });
  } finally {
    await context.dispose();
  }
}
