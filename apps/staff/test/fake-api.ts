/**
 * A fake API for the sign-in component tests: one answer (or a queue) per `METHOD /path`, and a
 * record of every request with its body and CSRF header. Use it from `vi.mock('@/lib/api')`, with
 * the real `createStaffApi` (this module must not import `@/lib/api`, or the mock waits on itself):
 *   `staffApi: () => actual.createStaffApi(origin, { fetch: fakeFetch, cookies: fakeCookies })`.
 */
export interface FakeAnswer {
  readonly status: number;
  readonly body?: unknown;
}

export const fake: {
  answers: Record<string, FakeAnswer | FakeAnswer[]>;
  requests: Array<{ key: string; body: unknown; csrf: string | null }>;
} = { answers: {}, requests: [] };

export function resetFake(answers: Record<string, FakeAnswer | FakeAnswer[]> = {}): void {
  fake.answers = answers;
  fake.requests = [];
}

/** The CSRF cookie the fake page holds. */
export const fakeCookies = () => 'quad_csrf=csrf-1';

export async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const key = `${request.method} ${new URL(request.url).pathname}`;
  const text = await request.text();
  fake.requests.push({
    key,
    body: text === '' ? undefined : JSON.parse(text),
    csrf: request.headers.get('x-csrf-token'),
  });
  const queued = fake.answers[key];
  const answer = Array.isArray(queued) ? queued.shift() : queued;
  if (answer === undefined) return new Response(null, { status: 599 });
  return answer.body === undefined
    ? new Response(null, { status: answer.status })
    : new Response(JSON.stringify(answer.body), {
        status: answer.status,
        headers: { 'content-type': 'application/json' },
      });
}
