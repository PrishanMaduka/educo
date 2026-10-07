import { robotsTagFor } from '@quad/contracts/web-env';
import { NextResponse } from 'next/server';

// The Node.js runtime reads APP_ENV when the server runs, so one image serves every environment.
export const config = { runtime: 'nodejs', matcher: '/:path*' };

/** Adds `X-Robots-Tag` where the staff app must not be indexed (spec 20). */
export function middleware(): NextResponse {
  const response = NextResponse.next();
  const robotsTag = robotsTagFor(process.env.APP_ENV, 'staff');
  if (robotsTag !== null) response.headers.set('x-robots-tag', robotsTag);
  return response;
}
