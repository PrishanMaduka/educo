import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Per-request values every log line carries. `tenantId` and `userId` stay null until the auth
 * guard (M1) resolves the session; the tenant is never taken from request input.
 */
export interface RequestContext {
  readonly requestId: string;
  tenantId: string | null;
  userId: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` (and everything it awaits) with a fresh context for `requestId`. */
export function runWithRequestContext<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId, tenantId: null, userId: null }, fn);
}

/** The current request's context, or undefined outside a request (boot, jobs). */
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
