import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { SEED_TENANTS } from '@quad/db';
import { afterEach, describe, expect, it } from 'vitest';

import { currentRequestContext, runWithRequestContext } from '../src/common/request-context';
import { TenantSpanProcessor, tagSpanWithTenant } from '../src/observability/tenant-span-processor';

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({
  spanProcessors: [new TenantSpanProcessor(), new SimpleSpanProcessor(exporter)],
});
const tracer = provider.getTracer('tenant-span-test');

describe('TenantSpanProcessor', () => {
  afterEach(() => {
    exporter.reset();
  });

  it('tags a span started inside a request with the tenant id', () => {
    const tenantId = SEED_TENANTS.colomboIntl.id;
    runWithRequestContext('req-1', () => {
      const context = currentRequestContext();
      if (context === undefined) throw new Error('no request context');
      context.tenantId = tenantId;
      tracer.startSpan('query').end();
    });

    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes.tenant_id).toBe(tenantId);
  });

  it('leaves a span in a request without a tenant untagged', () => {
    runWithRequestContext('req-2', () => {
      tracer.startSpan('sign-in').end();
    });

    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes).not.toHaveProperty('tenant_id');
  });

  it('leaves a span outside any request untagged', () => {
    tracer.startSpan('boot').end();

    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes).not.toHaveProperty('tenant_id');
  });
});

describe('tagSpanWithTenant', () => {
  afterEach(() => {
    exporter.reset();
  });

  it("tags a span that started before the guard knew the school (the request's own span)", () => {
    const tenantId = SEED_TENANTS.colomboIntl.id;
    const span = tracer.startSpan('GET /api/v1/me');
    tagSpanWithTenant(span, tenantId);
    span.end();
    expect(exporter.getFinishedSpans()[0]?.attributes.tenant_id).toBe(tenantId);
  });

  it('does nothing without a span or without a school', () => {
    const span = tracer.startSpan('sign-in');
    tagSpanWithTenant(span, null);
    tagSpanWithTenant(undefined, SEED_TENANTS.colomboIntl.id);
    span.end();
    expect(exporter.getFinishedSpans()[0]?.attributes).not.toHaveProperty('tenant_id');
  });
});
