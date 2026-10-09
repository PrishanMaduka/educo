import type { BrowserContext } from '@playwright/test';

/**
 * Lets a spec past the portal's signed-out redirect (the middleware only checks that a session
 * cookie is there) for the shell, which still shows placeholder people in M1 until Task 20 loads
 * `/me`. Task 20's `shell-auth.spec.ts` signs in through the stack instead and replaces this.
 */
export async function withPortalCookie(context: BrowserContext, baseURL: string): Promise<void> {
  await context.addCookies([
    { name: 'quad_sid', value: 'shell-placeholder-session', url: baseURL },
  ]);
}
