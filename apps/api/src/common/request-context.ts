import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Per-request values every log line carries. The auth guard fills in who is asking from the
 * session (never from request input); they stay null for public routes and before sign-in.
 */
export interface RequestContext {
  readonly requestId: string;
  /** The school, only once the session is active in one. */
  tenantId: string | null;
  /** The membership (`users.id`) in that school. */
  userId: string | null;
  /** The person's account; null in a support visit, which has none. */
  accountId: string | null;
  /** `web` or `mobile` for a person, `support` for a Quad support visit. */
  kind: 'web' | 'mobile' | 'support' | null;
  /** The role being previewed (spec 06, Preview a role). */
  previewRoleId: string | null;
  /** The support visit the request is part of (spec 05, dual audit). */
  supportSessionId: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

function emptyContext(requestId: string, tenantId: string | null): RequestContext {
  return {
    requestId,
    tenantId,
    userId: null,
    accountId: null,
    kind: null,
    previewRoleId: null,
    supportSessionId: null,
  };
}

/** Runs `fn` (and everything it awaits) with a fresh context for `requestId`. */
export function runWithRequestContext<T>(requestId: string, fn: () => T): T {
  return storage.run(emptyContext(requestId, null), fn);
}

/**
 * Runs a queued job (and everything it awaits) in a context of its own, so its log lines and
 * spans carry the job's tenant (D28 M1/M6 follow-up). `tenantId` comes from the job's payload
 * after the processor has parsed it, never from anywhere else.
 */
export function runWithJobContext<T>(jobKey: string, tenantId: string | null, fn: () => T): T {
  return storage.run(emptyContext(jobKey, tenantId), fn);
}

/** The current request's or job's context, or undefined outside both (boot). */
export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * The id for a request: the caller's `x-request-id` when it is a short safe token (so a proxy's
 * id carries through), otherwise a new UUID. Anything else is ignored so it cannot inject text
 * into logs.
 */
export function requestIdFrom(header: unknown): string {
  return typeof header === 'string' && SAFE_REQUEST_ID.test(header) ? header : randomUUID();
}
