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
 * session. One password call per use: the API allows 10 per address in 15 minutes.
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
