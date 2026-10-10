import { expect, type Page } from '@playwright/test';
import { test } from '@quad/config/playwright/stack';
import {
  QUAD_COOKIES,
  findRegistryEntry,
  matchesRegistry,
  registryEntry,
} from '@quad/contracts/cookies';

import { PEOPLE } from './sign-in-as';
import { GREETING, enterCode, openProfileMenu, title } from './steps';

/*
 * The cookie audit (spec 19 legal pages, D57): a visitor goes through everything the live site
 * and the portal do in a browser (the landing page and its theme and view, Sign in in the dialog
 * with "Trust this device", /app, Sign out, then a demo request), and afterwards the browser may
 * hold only cookies and storage keys that the registry (`QUAD_COOKIES`), and so the Cookies page,
 * names. The build has no Google Analytics Measurement ID, so no analytics cookie may appear; the
 * consent spec covers the fake ID (Task 13). The e2e build has no Turnstile site key, so the form
 * sends the local dummy token and nothing loads from Cloudflare.
 *
 * Prishan signs in with a password, which counts against her 10 calls in 15 minutes
 * (`PASSWORD_JOURNEY_PROJECTS`), so the audit runs in one project: what the browser stores does
 * not depend on the width or the colour scheme.
 */

const AUDIT_PROJECT = 'desktop-light';

/** Every key the page's own origin holds in `localStorage`. */
const storageKeys = (page: Page) =>
  page.evaluate(() =>
    Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? ''),
  );

test('the browser holds only the cookies and storage keys the Cookies page lists', async ({
  page,
  stack,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== AUDIT_PROJECT,
    'Prishan signs in with a password: see PASSWORD_JOURNEY_PROJECTS for the per-email limit',
  );
  const otherOrigins = new Set<string>();
  page.on('request', (request) => {
    const { hostname } = new URL(request.url());
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') otherOrigins.add(hostname);
  });

  // The landing page, with the theme and the view a visitor can choose.
  await page.goto('/');
  await page
    .locator('header')
    .getByRole('button', { name: /Switch to (dark|light) mode/ })
    .filter({ visible: true })
    .click();
  const views = page.getByRole('group', { name: 'Choose your view' });
  await views.getByRole('button', { name: 'I’m a parent' }).click();
  await views.getByRole('button', { name: 'I run a school' }).click();

  // Sign in in the dialog, trusting the device, into /app.
  await page
    .locator('header')
    .getByRole('button', { name: 'Sign in', exact: true })
    .filter({ visible: true })
    .click();
  const dialog = page.locator('[data-signin-dialog]');
  await dialog.getByLabel('Work email').fill(PEOPLE.prishan);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByLabel('Password', { exact: true }).fill(stack.seedPassword);
  await dialog.getByLabel('Keep me signed in on this device').check();
  await dialog.getByRole('button', { name: 'Sign in' }).click();
  await expect(title(page, 'Two-step sign-in')).toBeVisible();
  await page.getByLabel('Trust this device for 30 days').check();
  await enterCode(page, stack.fixedCode);
  await expect(page).toHaveURL('/app');
  await expect(title(page, GREETING)).toBeVisible();
  const signedIn = await page.context().cookies();
  expect(signedIn.map((cookie) => cookie.name)).toEqual(
    expect.arrayContaining(['quad_sid', 'quad_csrf', 'quad_trusted']),
  );
  const portalKeys = await storageKeys(page);

  // Sign out, then ask for a demo.
  const menu = await openProfileMenu(page);
  await menu.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
  await page.goto('/#demo');
  const form = page.locator('#demo form').filter({ visible: true });
  await form.getByLabel('Your name').fill('Sample Person');
  await form.getByLabel('Work email').fill(`audit+${String(Date.now())}@example.test`);
  await form.getByLabel('School').fill('Sample School');
  await form.getByRole('button', { name: /Request a demo/ }).click();
  await expect(page.locator('#demo').getByRole('status').filter({ visible: true })).toContainText(
    'Thank you.',
  );

  const cookies = [...signedIn, ...(await page.context().cookies())];
  const keys = [...portalKeys, ...(await storageKeys(page))];

  // Everything the browser holds is in the registry, under the right kind.
  expect(cookies.filter((cookie) => !matchesRegistry(cookie.name, 'cookie'))).toEqual([]);
  expect(keys.filter((key) => !matchesRegistry(key, 'local_storage'))).toEqual([]);
  // No analytics without a Measurement ID and the visitor's Accept.
  expect(
    cookies.filter((cookie) => findRegistryEntry(cookie.name)?.category === 'analytics'),
  ).toEqual([]);
  expect(cookies.some((cookie) => cookie.name.startsWith('_ga'))).toBe(false);
  // The audit saw the cookies it set out to see, so the checks above were not vacuous. Prishan has
  // one school, so there is no "remember this school" choice and no `quad_last_school`.
  expect(new Set(cookies.map((cookie) => findRegistryEntry(cookie.name)?.id))).toEqual(
    new Set(['session', 'csrf', 'trustedDevice']),
  );
  expect(new Set(keys)).toEqual(
    new Set([registryEntry('theme').names[0], registryEntry('siteView').names[0]]),
  );
  // Nothing loaded from another host: no Turnstile frame and no Google tag (OQ-T6).
  expect([...otherOrigins]).toEqual([]);
  expect(QUAD_COOKIES.filter((item) => item.category === 'analytics')).toHaveLength(2);
});
