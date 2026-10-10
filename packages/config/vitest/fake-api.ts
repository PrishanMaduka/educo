/**
 * A fake API for the web apps' component tests (staff and console): one answer (or a queue) per
 * `METHOD /path`, and a record of every request with its body and CSRF header. Use it from
 * `vi.mock('@/lib/api')`, with the app's real client factory (this module must not import the
 * app's `@/lib/api`, or the mock waits on itself):
 *   `staffApi: () => actual.createStaffApi(origin, { fetch: fakeFetch, cookies: fakeCookies })`.
 */
export interface FakeAnswer {
  readonly status: number;
  readonly body?: unknown;
  /** A text answer (a CSV export), sent as it is with `headers`, in place of `body`. */
  readonly text?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** A request with the headers and query a page sends besides its body. */
export interface FakeSent {
  key: string;
  body: unknown;
  csrf: string | null;
  query: Record<string, string>;
  ifMatch: string | null;
  accept: string | null;
}

export const fake: {
  answers: Record<string, FakeAnswer | FakeAnswer[]>;
  requests: Array<{ key: string; body: unknown; csrf: string | null }>;
  /** The same requests, with their query, If-Match and Accept. */
  sent: FakeSent[];
} = { answers: {}, requests: [], sent: [] };

export function resetFake(answers: Record<string, FakeAnswer | FakeAnswer[]> = {}): void {
  fake.answers = answers;
  fake.requests = [];
  fake.sent = [];
}

/** The CSRF cookies the fake page holds: the portal's and the console's, both `csrf-1`. */
export const fakeCookies = () => 'quad_csrf=csrf-1; quad_console_csrf=csrf-1';

export async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const key = `${request.method} ${url.pathname}`;
  const text = await request.text();
  const body: unknown = text === '' ? undefined : JSON.parse(text);
  const recorded = {
    key,
    body,
    csrf: request.headers.get('x-csrf-token'),
  };
  fake.requests.push(recorded);
  fake.sent.push({
    ...recorded,
    query: Object.fromEntries(url.searchParams),
    ifMatch: request.headers.get('if-match'),
    accept: request.headers.get('accept'),
  });
  const queued = fake.answers[key];
  const answer = Array.isArray(queued) ? queued.shift() : queued;
  if (answer === undefined) return new Response(null, { status: 599 });
  if (answer.text !== undefined) {
    return new Response(answer.text, { status: answer.status, headers: answer.headers });
  }
  return answer.body === undefined
    ? new Response(null, { status: answer.status })
    : new Response(JSON.stringify(answer.body), {
        status: answer.status,
        headers: { 'content-type': 'application/json' },
      });
}
