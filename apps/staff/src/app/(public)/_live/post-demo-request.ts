import type { DemoRequestBody } from '@quad/contracts/public';

/** What became of a demo request, as the form shows it (spec 19 "Demo requests"). */
export type DemoRequestOutcome =
  | { kind: 'sent' }
  /** 400 `validation`: the dotted paths the API refused (`email`, `_root`). */
  | { kind: 'invalid'; paths: string[] }
  | { kind: 'captcha_failed' }
  | { kind: 'rate_limited' }
  /** 503 `captcha_unavailable`, any other answer, a network error or the timeout. */
  | { kind: 'unavailable' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The error body's `code` and `fields` keys, or null when the answer is not an error body. */
async function errorOf(response: Response): Promise<{ code: string; paths: string[] } | null> {
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body) || typeof body.code !== 'string') return null;
  return { code: body.code, paths: isRecord(body.fields) ? Object.keys(body.fields) : [] };
}

/**
 * `POST /api/v1/public/demo-requests` (spec 06). Plain `fetch`, so the landing page carries no API
 * client. No credentials: the route is public and reads no session (D16). It never throws.
 */
export async function postDemoRequest(
  body: DemoRequestBody,
  timeoutMs: number,
): Promise<DemoRequestOutcome> {
  try {
    const response = await fetch('/api/v1/public/demo-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 202) return { kind: 'sent' };
    if (response.status === 429) return { kind: 'rate_limited' };
    const error = response.status === 400 ? await errorOf(response) : null;
    if (error?.code === 'validation') return { kind: 'invalid', paths: error.paths };
    if (error?.code === 'captcha_failed') return { kind: 'captcha_failed' };
    return { kind: 'unavailable' };
  } catch {
    // Offline, refused or timed out: the form offers the email fallback.
    return { kind: 'unavailable' };
  }
}
