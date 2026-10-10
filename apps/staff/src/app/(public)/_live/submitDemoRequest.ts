import type { DemoRequestOutcome } from './post-demo-request';
import type { DemoRequestBody } from '@quad/contracts/public';

export type { DemoRequestOutcome } from './post-demo-request';

/** Long enough for a slow connection; then the visitor gets the email fallback. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** The request code, its own chunk: fetched on the first focus in the form, not at first paint. */
const loadPost = () => import('./post-demo-request');

/** Fetches the request code ahead of the first submit (D57). */
export function prepareDemoRequest(): void {
  loadPost().catch(() => undefined);
}

/**
 * Sends a demo request to `POST /api/v1/public/demo-requests` (spec 19 "Demo requests") and says
 * what became of it. It never throws: a chunk that cannot load counts as unavailable.
 */
export async function submitDemoRequest(
  body: DemoRequestBody,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<DemoRequestOutcome> {
  try {
    const { postDemoRequest } = await loadPost();
    return await postDemoRequest(body, timeoutMs);
  } catch {
    return { kind: 'unavailable' };
  }
}
