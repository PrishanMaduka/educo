import { z } from 'zod';

/*
 * The signed-in hint's request (D57), its own chunk: `SignedInHint` loads it only when the
 * session's CSRF cookie is present, so an anonymous visitor downloads neither it nor Zod.
 */

/**
 * The part of `GET /me` the hint reads (the `Me` contract's `school.name`). A slice, not `Me`
 * itself, so the landing page does not load the contracts barrel; a type test keeps it a true
 * slice of `Me`.
 */
export const SignedInSchool = z.object({ school: z.object({ name: z.string().min(1) }) });

/** The school the browser's own session is in, or null when it has none or the API cannot say. */
export async function signedInSchoolName(signal: AbortSignal): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch('/api/v1/me', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal,
    });
  } catch {
    // Offline, blocked or left the page: the visitor keeps Sign in.
    return null;
  }
  if (!response.ok) return null;
  const body: unknown = await response.json().catch(() => null);
  const parsed = SignedInSchool.safeParse(body);
  return parsed.success ? parsed.data.school.name : null;
}
