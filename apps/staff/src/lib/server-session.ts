import { parseWebServerEnv } from '@quad/contracts/web-env';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { fetchPortalSession, sessionCookieHeader, type PortalSession } from './portal-session';
import { PORTAL_PATH_HEADER, signInAgainPath } from './session';

/**
 * The visit's session for server components: read once per request (the layout and the page
 * share it), from the API at `API_INTERNAL_URL` (OQ16) with the browser's session cookie.
 */
export const loadPortalSession = cache(async (): Promise<PortalSession> => {
  const { API_INTERNAL_URL } = parseWebServerEnv(process.env);
  const cookieStore = await cookies();
  return fetchPortalSession({
    apiUrl: API_INTERNAL_URL,
    cookieHeader: sessionCookieHeader(cookieStore.getAll()),
  });
});

/**
 * The session, or a redirect to sign-in (back to this page) when the API no longer accepts it:
 * the middleware only checks that a cookie is there.
 */
export async function requireSignedIn(): Promise<Exclude<PortalSession, { kind: 'signed_out' }>> {
  const session = await loadPortalSession();
  if (session.kind === 'signed_out') {
    redirect(signInAgainPath((await headers()).get(PORTAL_PATH_HEADER)));
  }
  return session;
}
