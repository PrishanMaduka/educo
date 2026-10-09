/** A compact JWS (three base64url parts) of a sane length: what an access token looks like. */
const BEARER = /^Bearer ([A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{0,1024})$/;

/**
 * The parent app's access token from `Authorization: Bearer <token>` (spec 06). Undefined when
 * the request has no Authorization header (the staff cookie is read instead); null for any other
 * Authorization value, which is refused rather than falling back to the cookie.
 */
export function bearerTokenOf(header: string | string[] | undefined): string | null | undefined {
  if (header === undefined) return undefined;
  if (typeof header !== 'string') return null;
  return BEARER.exec(header)?.[1] ?? null;
}
