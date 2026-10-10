/**
 * Sends a demo request to `POST /api/v1/public/demo-requests` (spec 19 "Demo requests"). Nothing
 * calls it yet: the forms open an email until the endpoint exists.
 * TODO(M1b): post the request with the Turnstile token and honeypot (plan Task 9).
 */
export function submitDemoRequest(): Promise<never> {
  return Promise.reject(new Error('Demo requests are not sent to Quad yet.'));
}
