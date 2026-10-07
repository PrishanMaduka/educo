import { SpanStatusCode } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ScrubSpanProcessor } from '@quad/contracts/observability';
import { afterEach, describe, expect, it } from 'vitest';

const TOKEN = 'k8Jq2xYz09AbCdEfGhIjKlMnOpQrStUvWx1';

// The same order as startTracing: scrub first, then the exporting processor.
const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({
  spanProcessors: [new ScrubSpanProcessor(), new SimpleSpanProcessor(exporter)],
});
const tracer = provider.getTracer('scrub-span-test');

describe('ScrubSpanProcessor on real spans', () => {
  afterEach(() => {
    exporter.reset();
  });

  it.each([
    ['fetch GET https://x/y?token=abc', 'fetch GET https://x/y'],
    [`GET /links/${TOKEN}?a=b`, 'GET /links/:token'],
    ['GET /api/v1/students/[id]', 'GET /api/v1/students/[id]'],
  ])('exports the span name %j as %j', (name, expected) => {
    tracer.startSpan(name).end();
    expect(exporter.getFinishedSpans()[0]?.name).toBe(expected);
  });

  it('scrubs the status message, attributes, events and links before export', () => {
    const linked = tracer.startSpan('parent');
    linked.end();
    const span = tracer.startSpan('job', {
      attributes: { 'url.full': 'https://quad-edu.com/x?token=abc' },
      links: [
        {
          context: linked.spanContext(),
          attributes: { 'peer.url': 'https://quad-edu.com/sign-in?code=123456' },
        },
      ],
    });
    span.addEvent('exception', { 'exception.message': 'No guardian amaya@example.com' });
    span.setAttribute('http.request.header.cookie', ['quad_session=abc']);
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'Failed for +94 77 000 0001' });
    span.end();

    const exported = exporter.getFinishedSpans().find((item) => item.name === 'job');
    expect(exported?.attributes).toEqual({ 'url.full': 'https://quad-edu.com/x' });
    expect(exported?.status.message).toBe('Failed for [phone]');
    expect(exported?.events[0]?.attributes).toEqual({ 'exception.message': 'No guardian [email]' });
    expect(exported?.links[0]?.attributes).toEqual({
      'peer.url': 'https://quad-edu.com/sign-in?code=[redacted]',
    });
  });
});
