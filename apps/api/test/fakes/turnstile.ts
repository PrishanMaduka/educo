import type {
  TurnstileCheck,
  TurnstileOutcome,
  TurnstileResult,
  TurnstileVerifier,
} from '../../src/common/turnstile/turnstile';

/**
 * A `TurnstileVerifier` for API tests that never reaches Cloudflare: it answers `outcome` (pass
 * by default) and records every check, so a test can assert the token, IP and action the route
 * passed, or that it never asked (a honeypot hit, a rate limit).
 */
export class FakeTurnstile implements TurnstileVerifier {
  readonly checks: TurnstileCheck[] = [];

  constructor(public outcome: TurnstileOutcome = 'pass') {}

  verify(check: TurnstileCheck): Promise<TurnstileResult> {
    this.checks.push(check);
    return Promise.resolve({ outcome: this.outcome });
  }
}

/** One recorded siteverify request: the URL, the method and the form fields it posted. */
export interface SiteverifyRequest {
  readonly url: string;
  readonly method: string | undefined;
  readonly form: Record<string, string>;
  readonly signal: AbortSignal | null | undefined;
}

/**
 * A stand-in for `fetch` that plays Cloudflare's siteverify: each call records the request and
 * gets `respond()`'s answer (a `Response`, or a thrown error for a network failure).
 */
export function fakeSiteverify(respond: (request: SiteverifyRequest) => Promise<Response>): {
  readonly fetch: typeof fetch;
  readonly requests: SiteverifyRequest[];
} {
  const requests: SiteverifyRequest[] = [];
  const fakeFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const body = init?.body;
    // The verifier posts a URLSearchParams body; anything else records no fields.
    const form = body instanceof URLSearchParams ? Object.fromEntries(body) : {};
    const request: SiteverifyRequest = {
      url: input instanceof Request ? input.url : String(input),
      method: init?.method,
      form,
      signal: init?.signal,
    };
    requests.push(request);
    return respond(request);
  };
  return { fetch: fakeFetch, requests };
}

/** A siteverify JSON answer. */
export function siteverifyResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
