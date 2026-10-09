import { currentRequestContext } from '../common/request-context';

import type { Span as ApiSpan } from '@opentelemetry/api';
import type { Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';

/**
 * Tags a span that was already running when the session was resolved: the request's own HTTP
 * span starts before `AuthGuard` knows the school, so the processor below cannot tag it (D28
 * follow-up). `AuthGuard` passes `trace.getActiveSpan()`.
 */
export function tagSpanWithTenant(
  span: Pick<ApiSpan, 'setAttribute'> | undefined,
  tenantId: string | null,
): void {
  if (span !== undefined && tenantId !== null) {
    span.setAttribute('tenant_id', tenantId);
  }
}

/**
 * Tags every span started inside a request with `tenant_id` (spec 15 → Observability), from the
 * request context the auth guard fills in from the session (never from request input). Spans
 * outside a request (boot, platform jobs) and before sign-in carry no tenant; spans already
 * running when the guard resolves the session are tagged by `tagSpanWithTenant`.
 */
export class TenantSpanProcessor implements SpanProcessor {
  onStart(span: Span): void {
    const tenantId = currentRequestContext()?.tenantId;
    if (tenantId !== undefined && tenantId !== null) {
      span.setAttribute('tenant_id', tenantId);
    }
  }

  onEnd(): void {
    // Tagging happens at start, so child spans of a request all carry the tenant.
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
