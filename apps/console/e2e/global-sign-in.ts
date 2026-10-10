import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { request, type FullConfig } from '@playwright/test';

import { OWNER_STATE, QUAD_STAFF, signInThroughApi } from './sign-in-as';

/**
 * Signs the platform owner in once per run, after the stack and the console start, for the
 * journeys that only read or do not touch the session (`test.use({ storageState: OWNER_STATE })`).
 * One of the owner's password calls (`PASSWORD_JOURNEY_PROJECTS`), never retried.
 */
export default async function globalSignIn(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (baseURL === undefined) throw new Error('The console Playwright config has no baseURL.');
  const context = await request.newContext({
    baseURL,
    // Its own client address for the per-IP bucket, apart from every test's (10.x.y.1–254).
    extraHTTPHeaders: { 'x-forwarded-for': '10.255.255.254' },
  });
  try {
    await signInThroughApi(context, QUAD_STAFF.owner.email);
    mkdirSync(dirname(OWNER_STATE), { recursive: true });
    await context.storageState({ path: OWNER_STATE });
  } finally {
    await context.dispose();
  }
}
