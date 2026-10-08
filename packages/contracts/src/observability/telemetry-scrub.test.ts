import { describe, expect, it } from 'vitest';

import {
  ScrubSpanProcessor,
  scrubSpanAttributes,
  scrubTelemetryText,
  scrubTelemetryUrl,
} from './telemetry-scrub';
import cases from './telemetry-scrub.cases.json';

describe('scrubTelemetryText', () => {
  // The cases are shared with the parent app's Dart port (apps/parent/test/core/sentry_test.dart).
  it.each(cases.scrubbed)('scrubs %j', (input, expected) => {
    expect(scrubTelemetryText(input)).toBe(expected);
  });

  it.each(cases.unchanged)('leaves %j alone', (input) => {
    expect(scrubTelemetryText(input)).toBe(input);
  });
});

describe('scrubTelemetryUrl', () => {
  it.each(cases.urls)('turns %j into %j', (input, expected) => {
    expect(scrubTelemetryUrl(input)).toBe(expected);
  });
});

describe('scrubSpanAttributes', () => {
  it('drops headers and the query, and scrubs every string value', () => {
    const attributes: Record<string, unknown> = {
      'http.request.header.authorization': ['Bearer abc'],
      'http.request.header.cookie': ['quad_session=abc'],
      'http.response.header.set-cookie': ['quad_session=abc'],
      'url.query': 'token=abc',
      'url.full': 'https://quad-edu.com/api/v1/sign-in?token=abc',
      'http.url': 'https://quad-edu.com/api/v1/sign-in?token=abc',
      'http.target': '/api/v1/sign-in?token=abc',
      'url.path': '/api/v1/sign-in',
      'http.route': '/api/v1/sign-in',
      'db.statement': "SELECT 1 WHERE email = 'amaya@example.com'",
      'exception.messages': ['for +94 77 000 0001', 'ok'],
      'http.response.status_code': 200,
      tenant_id: '0192a6f4-1b2c-7d3e-8f40-123456789abc',
    };

    scrubSpanAttributes(attributes);

    expect(attributes).toEqual({
      'url.full': 'https://quad-edu.com/api/v1/sign-in',
      'http.url': 'https://quad-edu.com/api/v1/sign-in',
      'http.target': '/api/v1/sign-in',
      'url.path': '/api/v1/sign-in',
      'http.route': '/api/v1/sign-in',
      'db.statement': "SELECT 1 WHERE email = '[email]'",
      'exception.messages': ['for [phone]', 'ok'],
      'http.response.status_code': 200,
      tenant_id: '0192a6f4-1b2c-7d3e-8f40-123456789abc',
    });
  });
});

describe('ScrubSpanProcessor', () => {
  it('scrubs the name, status message, attributes, event and link attributes when a span ends', async () => {
    const attributes: Record<string, unknown> = { 'url.full': 'https://quad-edu.com/x?token=abc' };
    const span = {
      name: 'GET /sign-in?token=abc',
      status: { code: 2, message: 'No user amaya@example.com' },
      attributes,
      events: [{ attributes: { 'exception.message': 'No user amaya@example.com' } }, {}],
      links: [{ attributes: { 'peer.url': 'https://x.example/y?code=1' } }, {}],
    };
    const processor = new ScrubSpanProcessor();

    processor.onStart();
    processor.onEnd(span);

    expect(span.name).toBe('GET /sign-in');
    expect(span.status.message).toBe('No user [email]');
    expect(span.attributes).toEqual({ 'url.full': 'https://quad-edu.com/x' });
    expect(span.events[0]?.attributes).toEqual({ 'exception.message': 'No user [email]' });
    expect(span.links[0]?.attributes).toEqual({
      'peer.url': 'https://x.example/y?code=[redacted]',
    });
    await expect(processor.forceFlush()).resolves.toBeUndefined();
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});
