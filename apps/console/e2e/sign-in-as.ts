import { fileURLToPath } from 'node:url';

import { STACK_FIXED_CODE, stackSecrets } from '@quad/config/playwright/stack';

import type { APIRequestContext } from '@playwright/test';

/** The seeded Quad staff (CLAUDE.md "Seeded local accounts"; packages/db `SEED_PLATFORM_USERS`). */
export const QUAD_STAFF = {
  owner: { email: 'owner@quad.local', name: 'Nora Lindqvist' },
  support: { email: 'support@quad.local', name: 'Amal Gunawardena' },
} as const;

/**
 * The projects where a journey that signs a seeded console user in with a password runs: one
 * light and one dark, at both widths, plus WebKit for the journeys tagged `@webkit`. The binding
 * limit is the API's per-email one on `POST /platform/auth/password` (`PER_EMAIL` in
 * `platform-auth.controller.ts`: 10 per address in 15 minutes); each test sends its own client
 * address, so the per-IP bucket never binds. CI retries a failed test once, so a journey's calls
 * count twice at worst; the global sign-ins are not retried. Password calls per address in one
 * CI run, at worst:
 * - owner: 1 global sign-in + 2 × (3 projects of journey 42, which ends with Sign out, + 1
 *   desktop-light wrong password beside an unknown address) = 9;
 * - support: 1 global sign-in (the support visit journey's state) + 2 × 3 projects of the
 *   sign-in journey = 7.
 * Add a password journey only where its person stays under 10.
 */
export const PASSWORD_JOURNEY_PROJECTS: readonly string[] = [
  'desktop-light',
  'phone-dark',
  'webkit-desktop-light',
];

/** Where the owner's shared signed-in state is kept for the run (`global-sign-in.ts`). */
export const OWNER_STATE = fileURLToPath(
  new URL('../test-results/.auth/owner.json', import.meta.url),
);

/**
 * Where Quad support's shared signed-in state is kept for the run (`global-sign-in.ts`). Opening
 * a support visit leaves the console session as it is, so parallel journeys can share it.
 */
export const SUPPORT_STATE = fileURLToPath(
  new URL('../test-results/.auth/support.json', import.meta.url),
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

const nextOf = (answer: unknown): unknown =>
  typeof answer === 'object' && answer !== null && 'next' in answer ? answer.next : undefined;

/**
 * Signs a seeded console user in through the API the way the page does (password, then the
 * stack's fixed code), so the request's context holds a real console session. One password call
 * per use (`PASSWORD_JOURNEY_PROJECTS`).
 */
export async function signInThroughApi(request: APIRequestContext, email: string): Promise<void> {
  const { seedPassword } = stackSecrets();
  const next = nextOf(
    await postJson(request, '/api/v1/platform/auth/password', { email, password: seedPassword }),
  );
  if (next !== 'two_step') throw new Error(`Signing in ${email} answered ${String(next)}.`);
  const { cookies } = await request.storageState();
  const csrf = cookies.find((cookie) => cookie.name === 'quad_console_csrf')?.value;
  if (csrf === undefined) throw new Error('No console CSRF cookie after the password step.');
  const done = nextOf(
    await postJson(request, '/api/v1/platform/auth/totp/verify', { code: STACK_FIXED_CODE }, csrf),
  );
  if (done !== 'done') throw new Error(`Signing in ${email} stopped at ${String(done)}.`);
}
