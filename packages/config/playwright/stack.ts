import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { test as base } from '@playwright/test';

import { stackSecrets } from './stack-secrets';

import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * The e2e stack (`scripts/e2e-stack.mjs`, Task 18, D32) as Playwright sees it: a fresh database
 * migrated and seeded per run, the API and worker on a port of their own, Mailpit for email and
 * the fixed code `000000`.
 */

/**
 * The stack's default port: the one the web builds rewrite `/api/v1` and `/socket.io` to
 * (`NEXT_PUBLIC_API_URL` defaults to http://localhost:4000 and is fixed at build time). A stack on
 * another port only reaches the pages if the app was built with `NEXT_PUBLIC_API_URL` set to it.
 */
export const DEFAULT_STACK_PORT = 4000;

/** The code every one-time password and authenticator check accepts in the stack (`DEV_FIXED_OTP`). */
export const STACK_FIXED_CODE = '000000';

export { stackSecrets };

export type ConfigWebServer = Exclude<
  NonNullable<PlaywrightTestConfig['webServer']>,
  readonly unknown[]
>;

const STACK_SCRIPT = fileURLToPath(new URL('../../../scripts/e2e-stack.mjs', import.meta.url));

/** The API's origin for a stack on `port`. */
export function stackOrigin(port: number = DEFAULT_STACK_PORT): string {
  return `http://localhost:${String(port)}`;
}

/**
 * The `webServer` entry that runs the stack. Playwright waits for `/api/v1/health/ready` (200
 * once Postgres and Redis answer) and, at the end, sends SIGTERM and waits, so the stack stops
 * the API and worker and drops its database. Never reused: a running `pnpm dev` API on the port
 * would be tested instead, against the developer's database.
 */
export function stackWebServer(port: number = DEFAULT_STACK_PORT): ConfigWebServer {
  return {
    command: `node ${JSON.stringify(STACK_SCRIPT)} --port ${String(port)}`,
    url: `${stackOrigin(port)}/api/v1/health/ready`,
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 30_000 },
    stdout: 'ignore',
    stderr: 'pipe',
  };
}

/** What a spec needs to talk to the stack. */
export interface Stack {
  readonly port: number;
  /** `http://localhost:<port>`; the API is under `/api/v1`. */
  readonly origin: string;
  /** Every seeded staff member and console user signs in with it. */
  readonly seedPassword: string;
  /** `000000`. */
  readonly fixedCode: string;
}

/** The `stackPort` option (`use: { stackPort }`), set by `defineWebAppConfig({ stack })`. */
export interface StackOptions {
  readonly stackPort: number;
}

/**
 * A private address (`10.x.y.z`) for one test run: the test, its project and its retry. The
 * stack trusts one proxy hop (the web app's rewrite), so a test that sends it as
 * `X-Forwarded-For` is its own client and gets its own per-IP sign-in limit (20 a minute), as
 * people at different schools would. Without it every parallel journey would share one bucket.
 */
export function clientAddressFor(testId: string, project: string, retry: number): string {
  const [a = 0, b = 0, c = 0] = createHash('sha256')
    .update(`${project}\u0000${testId}\u0000${String(retry)}`)
    .digest();
  return `10.${String(a)}.${String(b)}.${String(1 + (c % 254))}`;
}

/**
 * `test` with the `stack` fixture: `test('…', async ({ page, stack }) => …)`, and each test's
 * requests sent as its own client. The port comes from
 * the project's `stackPort` option, so a config can run its stack on :4001 beside another on
 * :4000.
 */
export const test = base.extend<{ stack: Stack }, StackOptions>({
  stackPort: [DEFAULT_STACK_PORT, { option: true, scope: 'worker' }],
  // Every request the test's pages make carries its own client address (`clientAddressFor`).
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
    await use({
      ...extraHTTPHeaders,
      'x-forwarded-for': clientAddressFor(testInfo.testId, testInfo.project.name, testInfo.retry),
    });
  },
  stack: async ({ stackPort }, use) => {
    const { seedPassword } = stackSecrets();
    await use({
      port: stackPort,
      origin: stackOrigin(stackPort),
      seedPassword,
      fixedCode: STACK_FIXED_CODE,
    });
  },
});
