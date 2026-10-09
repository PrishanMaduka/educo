import { describe, expect, it } from 'vitest';

import { parseOtlpHeaders, startTracing } from '../src/observability/tracing';

describe('tracing', () => {
  it('does nothing when OTEL_EXPORTER_OTLP_ENDPOINT is empty', async () => {
    const tracing = await startTracing({}, 'api');
    expect(tracing.enabled).toBe(false);
    await expect(tracing.shutdown()).resolves.toBeUndefined();
  });

  it('starts and shuts down the SDK when an endpoint is set', async () => {
    const tracing = await startTracing(
      { OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:1', OTEL_SERVICE_NAME: 'quad-api-test' },
      'api',
    );
    expect(tracing.enabled).toBe(true);
    await expect(tracing.shutdown()).resolves.toBeUndefined();
    // startTracing imports the OpenTelemetry SDK on first use. Alone that takes about 0.25 s, but
    // under the full parallel suite the cold imports took just over vitest's 5 s default.
  }, 30_000);

  it('parses W3C-style exporter headers', () => {
    expect(parseOtlpHeaders(undefined)).toEqual({});
    expect(parseOtlpHeaders('Authorization=Basic%20abc, x-team = quad')).toEqual({
      Authorization: 'Basic abc',
      'x-team': 'quad',
    });
  });
});
