import type { Config } from '../config';

export interface Tracing {
  readonly enabled: boolean;
  /** Flushes pending spans and stops the SDK. */
  shutdown(): Promise<void>;
}

const DISABLED: Tracing = { enabled: false, shutdown: () => Promise.resolve() };

/** Parses `OTEL_EXPORTER_OTLP_HEADERS` (`key=value,key2=value2`, values URL-encoded). */
export function parseOtlpHeaders(raw: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const pair of (raw ?? '').split(',')) {
    const at = pair.indexOf('=');
    if (at <= 0) continue;
    headers[pair.slice(0, at).trim()] = decodeURIComponent(pair.slice(at + 1).trim());
  }
  return headers;
}

type TracingConfig = Partial<
  Pick<Config, 'OTEL_EXPORTER_OTLP_ENDPOINT' | 'OTEL_EXPORTER_OTLP_HEADERS' | 'OTEL_SERVICE_NAME'>
>;

/**
 * Starts OpenTelemetry tracing (spec 15 → Observability) for HTTP, Fastify, Postgres and Redis.
 * Call it before anything imports those libraries: `main.ts` and `worker.ts` load the rest of the
 * app with a dynamic `import()` afterwards, because the instrumentations patch modules as they
 * are first required. Does nothing, and loads nothing, when no endpoint is configured.
 */
export async function startTracing(
  config: TracingConfig,
  service: 'api' | 'worker',
): Promise<Tracing> {
  const endpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (endpoint === undefined) {
    return DISABLED;
  }
  const [sdkNode, exporter, http, pg, ioredis, fastify] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/instrumentation-http'),
    import('@opentelemetry/instrumentation-pg'),
    import('@opentelemetry/instrumentation-ioredis'),
    import('@fastify/otel'),
  ]);
  const sdk = new sdkNode.NodeSDK({
    serviceName: config.OTEL_SERVICE_NAME ?? `quad-${service}`,
    traceExporter: new exporter.OTLPTraceExporter({
      url: `${endpoint.replace(/\/+$/, '')}/v1/traces`,
      headers: parseOtlpHeaders(config.OTEL_EXPORTER_OTLP_HEADERS),
    }),
    instrumentations: [
      new http.HttpInstrumentation(),
      new fastify.FastifyOtelInstrumentation({ registerOnInitialization: true }),
      // Statement text only, never bound values (they can be personal data).
      new pg.PgInstrumentation({ enhancedDatabaseReporting: false }),
      // Command names only, never keys or values.
      new ioredis.IORedisInstrumentation({ dbStatementSerializer: (command) => command }),
    ],
  });
  sdk.start();
  return { enabled: true, shutdown: () => sdk.shutdown() };
}
