import { robotsTagFor } from '@quad/contracts/web-env';
import { NextResponse, type NextRequest } from 'next/server';

import { hasSessionCookie, signInPathFor } from '@/lib/session';

// The Node.js runtime reads APP_ENV when the server runs, so one image serves every environment.
// The matcher covers every page and route handler (`/healthz` included) and skips hashed static
// files and image optimisation.
export const config = { runtime: 'nodejs', matcher: '/((?!_next/static|_next/image).*)' };

/** The portal: `/app` and everything below it. */
const PORTAL = /^\/app(?:\/|$)/;
/** The signed-link pages, whose path carries the token (D32). */
const TOKEN_PAGE = /^\/sign-in\/(?:reset|invite|support)\/[^/]+\/?$/;

/**
 * - A visit to the portal without the session cookie goes to `/sign-in?next=<page>` (307). The
 *   cookie is only a hint: the API still checks the session on every call.
 * - The signed-link pages get `Referrer-Policy: no-referrer` and at least `X-Robots-Tag: noindex`,
 *   so the token never leaves in a Referer header or reaches a search index.
 * - `X-Robots-Tag` where the staff app must not be indexed (spec 20).
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (PORTAL.test(pathname) && !hasSessionCookie((name) => request.cookies.get(name)?.value)) {
    return NextResponse.redirect(new URL(signInPathFor(pathname, search), request.url), 307);
  }
  const response = NextResponse.next();
  const robotsTag = robotsTagFor(process.env.APP_ENV, 'staff');
  if (TOKEN_PAGE.test(pathname)) {
    response.headers.set('referrer-policy', 'no-referrer');
    response.headers.set('x-robots-tag', robotsTag ?? 'noindex');
  } else if (robotsTag !== null) {
    response.headers.set('x-robots-tag', robotsTag);
  }
  return response;
}
