import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { request, type FullConfig } from '@playwright/test';

import { OWNER_STATE, QUAD_STAFF, SUPPORT_STATE, signInThroughApi } from './sign-in-as';

/** Signs one console user in through the API and saves the state, from its own client address. */
async function saveSignedIn(
  baseURL: string,
  email: string,
  path: string,
  clientAddress: string,
): Promise<void> {
  const context = await request.newContext({
    baseURL,
    // Its own client address for the per-IP bucket, apart from every test's (10.x.y.1–254).
    extraHTTPHeaders: { 'x-forwarded-for': clientAddress },
  });
  try {
    await signInThroughApi(context, email);
    mkdirSync(dirname(path), { recursive: true });
    await context.storageState({ path });
  } finally {
    await context.dispose();
  }
}

/**
 * Signs the platform owner and Quad support in once per run, after the stack and the console
 * start, for the journeys that only read or do not touch the console session
 * (`test.use({ storageState: OWNER_STATE })`, `SUPPORT_STATE` for the support visit). One
 * password call each (`PASSWORD_JOURNEY_PROJECTS`), never retried.
 */
export default async function globalSignIn(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (baseURL === undefined) throw new Error('The console Playwright config has no baseURL.');
  await saveSignedIn(baseURL, QUAD_STAFF.owner.email, OWNER_STATE, '10.255.255.254');
  await saveSignedIn(baseURL, QUAD_STAFF.support.email, SUPPORT_STATE, '10.255.255.253');
}
