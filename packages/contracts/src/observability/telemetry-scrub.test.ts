import { describe, expect, it } from 'vitest';

import { ScrubSpanProcessor, scrubSpanAttributes, scrubTelemetryText } from './telemetry-scrub';

describe('scrubTelemetryText', () => {
  it.each([
    ['No guardian for amaya.perera@example.com', 'No guardian for [email]'],
    ['Call +94 77 000 0001 now', 'Call [phone] now'],
    ['Call +94770000001', 'Call [phone]'],
    ['Local 077 000 0001 and 0770000001', 'Local [phone] and [phone]'],
    ['Authorization: Bearer abc.def-ghi', 'Authorization: Bearer [redacted]'],
    ['basic dXNlcjpwYXNz', 'basic [redacted]'],
    ['GET /sign-in?token=s3cret&next=%2Fhome', 'GET /sign-in?token=[redacted]&next=[redacted]'],
    [
      'https://quad-edu.com/api/v1/x?code=123#top',
      'https://quad-edu.com/api/v1/x?code=[redacted]#top',
    ],
    ['/api/v1/links/k8Jq2xYz09AbCdEfGhIjKlMnOpQrStUvWx1/open', '/api/v1/links/:token/open'],
  ])('scrubs %j', (input, expected) => {
    expect(scrubTelemetryText(input)).toBe(expected);
  });

  it.each([
    ['SELECT id FROM students WHERE tenant_id = $1 AND id = $2'],
    ['/api/v1/students/0192a6f4-1b2c-7d3e-8f40-123456789abc'],
    ['Request took 1234 ms at 2026-10-07T08:30:00+05:30'],
    ['/home/user/educo/node_modules/@opentelemetry/instrumentation-ioredis/build/index.js'],
    ['0192a6f41b2c7d3e8f40123456789abc'],
  ])('leaves %j alone', (input) => {
    expect(scrubTelemetryText(input)).toBe(input);
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
  it('scrubs span and event attributes when the span ends', async () => {
    const attributes: Record<string, unknown> = { 'url.full': 'https://quad-edu.com/x?token=abc' };
    const span = {
      attributes,
      events: [{ attributes: { 'exception.message': 'No user amaya@example.com' } }, {}],
    };
    const processor = new ScrubSpanProcessor();

    processor.onStart();
    processor.onEnd(span);

    expect(span.attributes).toEqual({ 'url.full': 'https://quad-edu.com/x' });
    expect(span.events[0]?.attributes).toEqual({ 'exception.message': 'No user [email]' });
    await expect(processor.forceFlush()).resolves.toBeUndefined();
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});
