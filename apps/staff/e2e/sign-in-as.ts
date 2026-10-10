import { fileURLToPath } from 'node:url';

import { STACK_FIXED_CODE, stackSecrets } from '@quad/config/playwright/stack';

import type { APIRequestContext } from '@playwright/test';

/** The seeded staff people the shell journeys sign in as (CLAUDE.md "Seeded local accounts"). */
export const PEOPLE = {
  prishan: 'prishan.maduka@colombo-intl.local',
  nadeesha: 'nadeesha.jayasinghe@colombo-intl.local',
  ruwan: 'ruwan.mendis@quad.local',
  dilini: 'dilini.fernando@colombo-intl.local',
} as const;

/**
 * The projects where a journey that signs a seeded person in with a password runs: one light and
 * one dark, at both widths, plus WebKit for the journeys tagged `@webkit`. The binding limit is
 * the API's per-email one on `POST /auth/password` (`PER_EMAIL` in `auth.controller.ts`: 10 calls
 * per address in 15 minutes); the per-IP bucket (20 a minute) never binds, since each test sends
 * its own client address. Each run starts with an empty rate-limit store (the stack's own Redis
 * database), and CI retries a failed test once (`retries: 1`), so a journey's calls count twice
 * at worst. The global sign-in is not retried. Password calls per address in one CI run, at worst:
 * - Prishan: 1 global sign-in + 2 × 3 projects of journey 17 = 7;
 * - Ruwan: 2 × 3 projects of journey 18 (Choose a school, then Switch school) = 6;
 * - Nadeesha: 2 × 4 projects of the teacher's journey = 8;
 * - Dilini: 2 × 3 projects of Sign out = 6;
 * - the people journeys 19, 43 and 50 invite (journey 50's School admin signs in once): their
 *   own address per test, project, retry and run.
 * Add a password journey only where its person stays under 10.
 */
export const PASSWORD_JOURNEY_PROJECTS: readonly string[] = [
  'desktop-light',
  'phone-dark',
  'webkit-desktop-light',
];

/** Where the shared signed-in state of Prishan is kept for the run (`global-sign-in.ts`). */
export const PRISHAN_STATE = fileURLToPath(
  new URL('../test-results/.auth/prishan.json', import.meta.url),
);

async function postJson(
  request: APIRequestContext,
  path: string,
  data: unknown,
  csrf?: string,
): Promise<unknown> {
  const response = await request.post(path, {
    data,
    headers: csrf === undefined ? {} : { 'x-csrf-token': csrf },
  });
  if (!response.ok()) {
    throw new Error(`${path} answered ${String(response.status())}: ${await response.text()}`);
  }
  return response.status() === 204 ? null : response.json();
}

async function csrfOf(request: APIRequestContext): Promise<string> {
  const { cookies } = await request.storageState();
  const token = cookies.find((cookie) => cookie.name === 'quad_csrf')?.value;
  if (token === undefined) throw new Error('No CSRF cookie after the password step.');
  return token;
}

const nextOf = (answer: unknown): unknown =>
  typeof answer === 'object' && answer !== null && 'next' in answer ? answer.next : undefined;

/**
 * Signs in through the API the way the page does (password, then the stack's fixed code, then
 * the school by name when there are several), so the request's browser context holds a real
 * session. One password call per use, counted against the address's 10 in 15 minutes
 * (`PASSWORD_JOURNEY_PROJECTS`).
 */
export async function signInThroughApi(
  request: APIRequestContext,
  email: string,
  school?: string,
): Promise<void> {
  const { seedPassword } = stackSecrets();
  const afterPassword = await postJson(request, '/api/v1/auth/password', {
    email,
    password: seedPassword,
    keepSignedIn: true,
  });
  let next = nextOf(afterPassword);
  if (next === 'two_step') {
    const csrf = await csrfOf(request);
    next = nextOf(
      await postJson(request, '/api/v1/auth/totp/verify', { code: STACK_FIXED_CODE }, csrf),
    );
  }
  if (next === 'choose_school') {
    const list = await request.get('/api/v1/auth/memberships');
    const { items } = (await list.json()) as { items: { tenantId: string; name: string }[] };
    const chosen = items.find((item) => item.name === school) ?? items[0];
    if (chosen === undefined) throw new Error(`${email} has no school to choose.`);
    await postJson(
      request,
      '/api/v1/auth/select-school',
      { tenantId: chosen.tenantId, remember: false },
      await csrfOf(request),
    );
    next = 'done';
  }
  if (next !== 'done') throw new Error(`Signing in ${email} stopped at ${String(next)}.`);
}
