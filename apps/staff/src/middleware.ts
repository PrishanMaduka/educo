import { robotsTagFor } from '@quad/contracts/web-env';
import { NextResponse } from 'next/server';

// The Node.js runtime reads APP_ENV when the server runs, so one image serves every environment.
// The matcher covers every page and route handler (`/healthz` included) and skips hashed static
// files and image optimisation.
export const config = { runtime: 'nodejs', matcher: '/((?!_next/static|_next/image).*)' };

/** Adds `X-Robots-Tag` where the staff app must not be indexed (spec 20). */
export function middleware(): NextResponse {
  const response = NextResponse.next();
  const robotsTag = robotsTagFor(process.env.APP_ENV, 'staff');
  if (robotsTag !== null) response.headers.set('x-robots-tag', robotsTag);
  return response;
}
