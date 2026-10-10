'use client';

import { cookieValue } from '@quad/client/cookies';
import { CSRF_COOKIE, hostPrefixedNames } from '@quad/contracts/cookie-names';
import { useEffect } from 'react';

import { setOpenSchool } from './open-school';

/** The session's readable CSRF cookie: only a signed-in browser has it (D57's gate). */
const CSRF_COOKIES = hostPrefixedNames(CSRF_COOKIE);

/**
 * Open {school} for a signed-in visitor (spec 19 "Sign-in", D57). After hydration, if the session's
 * CSRF cookie is present, it loads `signed-in-school` and asks `GET /api/v1/me`; on 200 every
 * Sign in on the page becomes a link "Open {school}" to `/app`, with the name from that answer
 * only. On 401, 403, an error or offline nothing changes. It never reads `quad_last_school`. A
 * support session or a role preview is signed in too: the API decides what `/app` shows.
 * `openSchool` is "Open {school}" split around the name, formatted on the server.
 */
export function SignedInHint({
  openSchool,
}: {
  openSchool: { before: string; after: string };
}): null {
  const { before, after } = openSchool;
  useEffect(() => {
    if (cookieValue(document.cookie, CSRF_COOKIES) === null) return undefined;
    const controller = new AbortController();
    void import('./signed-in-school')
      .then(({ signedInSchoolName }) => signedInSchoolName(controller.signal))
      // The chunk could not load (offline): the visitor keeps Sign in.
      .catch(() => null)
      .then((name) => {
        if (name !== null && !controller.signal.aborted) setOpenSchool(`${before}${name}${after}`);
      });
    return () => {
      controller.abort();
      setOpenSchool(null);
    };
  }, [before, after]);
  return null;
}
