import { currentRequestContext } from '../common/request-context';

import type { Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';

/**
 * Tags every span started inside a request with `tenant_id` (spec 15 → Observability), from the
 * request context the auth guard fills in from the session (never from request input). Spans
 * outside a request (boot, platform jobs) and before sign-in carry no tenant.
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
