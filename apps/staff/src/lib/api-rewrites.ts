/** A Next.js rewrite (the shape `rewrites()` returns). */
export interface Rewrite {
  readonly source: string;
  readonly destination: string;
}

/**
 * What the staff app proxies to the API (spec 02, Local development). Locally the API runs on
 * :4000; in staging and production the edge routes both paths first. The realtime client uses
 * `/socket.io` without a trailing slash, which the API accepts, because Next.js would redirect
 * `/socket.io/` before any rewrite (D28 follow-up).
 */
export function apiRewrites(apiUrl: string): Rewrite[] {
  return [
    { source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` },
    { source: '/socket.io', destination: `${apiUrl}/socket.io` },
  ];
}
