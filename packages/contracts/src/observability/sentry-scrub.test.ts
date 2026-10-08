import { describe, expect, it } from 'vitest';

import { scrubSentryEvent } from './sentry-scrub';

describe('scrubSentryEvent', () => {
  it('keeps only the user-agent header and the user id', () => {
    const event = {
      request: {
        url: 'https://quad-edu.com/api/v1/sign-in',
        method: 'POST',
        env: { REMOTE_ADDR: '203.0.113.9' },
        data: { phone: '+94 77 000 0001', note: 'allergy: peanuts' },
        cookies: { quad_session: 'abc' },
        query_string: 'token=abc',
        headers: {
          Authorization: 'Bearer abc',
          Cookie: 'quad_session=abc',
          'User-Agent': 'Mozilla/5.0',
          'x-forwarded-for': '203.0.113.9',
        },
      },
      user: { id: 'u-1', email: 'amaya@example.com', ip_address: '203.0.113.9', username: 'amaya' },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed).toBe(event);
    expect(scrubbed.request).toEqual({
      url: 'https://quad-edu.com/api/v1/sign-in',
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    expect(scrubbed.user).toEqual({ id: 'u-1' });
  });

  it('removes a user that has no id', () => {
    const event: { user?: { id?: string; email?: string } } = {
      user: { email: 'amaya@example.com' },
    };
    expect(scrubSentryEvent(event).user).toBeUndefined();
  });

  it('scrubs emails, phone numbers and query values from messages, breadcrumbs and extras', () => {
    const event = {
      message: 'Sent to amaya@example.com',
      request: { url: 'https://quad-edu.com/links/open?token=abc' },
      exception: {
        values: [
          {
            value: 'No guardian with phone +94 77 000 0001',
            stacktrace: {
              frames: [
                {
                  filename: '/app/dist/main.js',
                  lineno: 10,
                  context_line: "  const to = 'amaya@example.com';",
                  vars: { guardian: { phone: '+94 77 000 0001' } },
                },
              ],
            },
          },
        ],
      },
      breadcrumbs: [
        { category: 'http', data: { url: 'https://api.example.com/v1/send?to=amaya@example.com' } },
        { category: 'navigation', data: { from: '/', to: '/sign-in?code=123456' } },
      ],
      extra: { header: 'Bearer abc.def', trace: 'sent to amaya@example.com' },
      contexts: {
        trace: { trace_id: '94770000001a4b5c6d7e8f9012345678', span_id: '94770000001a4b5c' },
        app: { note: 'call 0770000001' },
      },
      event_id: '0192a6f41b2c7d3e8f40123456789abc',
    };

    scrubSentryEvent(event);

    expect(event.message).toBe('Sent to [email]');
    expect(event.request.url).toBe('https://quad-edu.com/links/open');
    expect(event.exception.values[0]?.value).toBe('No guardian with phone [phone]');
    expect(event.exception.values[0]?.stacktrace).toEqual({
      frames: [
        { filename: '/app/dist/main.js', lineno: 10, context_line: "  const to = '[email]';" },
      ],
    });
    expect(event.breadcrumbs).toEqual([
      { category: 'http', data: { url: 'https://api.example.com/v1/send?to=[redacted]' } },
      { category: 'navigation', data: { from: '/', to: '/sign-in?code=[redacted]' } },
    ]);
    expect(event.extra).toEqual({ header: 'Bearer [redacted]', trace: 'sent to [email]' });
    expect(event.contexts).toEqual({
      trace: { trace_id: '94770000001a4b5c6d7e8f9012345678', span_id: '94770000001a4b5c' },
      app: { note: 'call [phone]' },
    });
    expect(event.event_id).toBe('0192a6f41b2c7d3e8f40123456789abc');
  });

  it('keeps only the trace ids in contexts.trace and scrubs every other trace field', () => {
    const ids = {
      trace_id: '94770000001a4b5c6d7e8f9012345678',
      span_id: '94770000001a4b5c',
      parent_span_id: '0770000001abcdef',
    };
    const event = {
      message: 'Trace for amaya@example.com',
      user: { id: 7 },
      contexts: {
        trace: {
          ...ids,
          op: 'http.server',
          description: 'GET /links/open?token=abc123',
          data: { 'http.url': 'https://quad-edu.com/p?email=amaya@example.com' },
          status: 'sent to amaya@example.com',
        },
      },
    };

    scrubSentryEvent(event);

    expect(event.message).toBe('Trace for [email]');
    expect(event.contexts.trace).toEqual({
      ...ids,
      op: 'http.server',
      description: 'GET /links/open?token=[redacted]',
      data: { 'http.url': 'https://quad-edu.com/p?email=[redacted]' },
      status: 'sent to [email]',
    });
  });
});
