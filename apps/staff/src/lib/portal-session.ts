import { createApiClient } from '@quad/client';
import { Me, MePermissions } from '@quad/contracts';

import { ApiError, unwrap } from './api';
import { SESSION_COOKIES } from './session';

import type { ZodType } from 'zod';

/** The session cookies the API reads (spec 05; D32): `quad_sid` locally, `__Host-` elsewhere. */
const SESSION_COOKIE_NAMES: ReadonlySet<string> = new Set(SESSION_COOKIES);

/**
 * What the portal layout knows about the visit before it renders anything:
 * - `ready`: who is signed in, their school and what they may open;
 * - `signed_out`: the session expired or was revoked (401), so sign in again;
 * - `suspended`: the school is paused (403 `school_suspended`), with the reason to show.
 */
export type PortalSession =
  | { readonly kind: 'ready'; readonly me: Me; readonly permissions: MePermissions }
  | { readonly kind: 'signed_out' }
  | { readonly kind: 'suspended'; readonly reason: string };

export interface PortalSessionRequest {
  /** `API_INTERNAL_URL`: the API origin the server calls directly (OQ16). */
  readonly apiUrl: string;
  /** The browser's session cookie, as a `Cookie` header (`sessionCookieHeader`). */
  readonly cookieHeader: string;
  /** For tests; the server's own by default. */
  readonly fetch?: typeof fetch;
}

/** The `Cookie` header for the API: the session cookie only, never the page's other cookies. */
export function sessionCookieHeader(
  cookies: readonly { readonly name: string; readonly value: string }[],
): string {
  return cookies
    .filter((cookie) => SESSION_COOKIE_NAMES.has(cookie.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

/**
 * The answer checked against its contract: the shell puts `/me`'s brand colours into an inline
 * style, so only values the contract accepts (`HexColor`) may reach it. A body the contract
 * refuses is thrown, and the error page shows instead of the shell.
 */
function parsed<T>(schema: ZodType<T>, body: unknown, route: string): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`GET ${route} answered a body its contract refuses.`, { cause: result.error });
  }
  return result.data;
}

/**
 * `GET /me` and `GET /me/permissions` for the portal shell, from a server component (spec 06).
 * Both are reads, so no CSRF header. Nothing is cached: every page load asks the API, which
 * checks the session each time. Both bodies are parsed with the contracts.
 */
export async function fetchPortalSession({
  apiUrl,
  cookieHeader,
  fetch: fetchImpl,
}: PortalSessionRequest): Promise<PortalSession> {
  const api = createApiClient(apiUrl, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
    ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
  });
  try {
    const [me, permissions] = await Promise.all([
      unwrap(api.GET('/api/v1/me')),
      unwrap(api.GET('/api/v1/me/permissions')),
    ]);
    return {
      kind: 'ready',
      me: parsed(Me, me, '/me'),
      permissions: parsed(MePermissions, permissions, '/me/permissions'),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { kind: 'signed_out' };
    if (error instanceof ApiError && error.code === 'school_suspended') {
      return { kind: 'suspended', reason: error.message };
    }
    throw error;
  }
}
