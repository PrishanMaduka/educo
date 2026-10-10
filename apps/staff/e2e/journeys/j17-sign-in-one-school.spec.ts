import { expect, type Page } from '@playwright/test';
import { schemeOf } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';
import { deriveBrand } from '@quad/tokens';

import { PASSWORD_JOURNEY_PROJECTS, PEOPLE } from '../sign-in-as';
import {
  GREETING,
  brandVariable,
  closeNav,
  enterCode,
  expectAccessibleOnceStill,
  openNav,
  title,
} from '../steps';

/*
 * Journey 17 (spec 17), "Sign-in, one school": Prishan opens Sign in on the landing page, enters
 * her email, password and the code 000000, and lands in /app with Colombo International School's
 * name and colour. The landing here is the normal build (NEXT_PUBLIC_QUAD_PRELAUNCH unset), whose
 * Sign in opens the M1 flow in a dialog on the landing page (D57); the pre-launch export's
 * coming-soon note is `landing.spec.ts`'s. CIS has no logo in the seed, so its
 * tile is its short name on its brand fill. The brand is the shell's brand-raw token
 * (`--quad-brand-raw`), the seed's saved #DD4A42 (kept by D34). One password call per run of it for
 * Prishan (`PASSWORD_JOURNEY_PROJECTS`).
 */

const CIS = 'Colombo International School';
const CIS_BRAND = '#DD4A42';
const isNarrowLanding = (page: Page) => (page.viewportSize()?.width ?? 0) <= 1100;

test(
  'J17: Sign in on the landing page opens the portal, then Prishan lands in her school',
  { tag: '@webkit' },
  async ({ page, stack }, testInfo) => {
    test.skip(
      !PASSWORD_JOURNEY_PROJECTS.includes(testInfo.project.name),
      'Prishan signs in with a password: see PASSWORD_JOURNEY_PROJECTS for the per-email limit',
    );
    await page.goto('/');
    if (isNarrowLanding(page)) await page.getByRole('button', { name: 'Menu' }).click();
    const signIn = page
      .locator('header')
      .getByRole('button', { name: 'Sign in', exact: true })
      .filter({ visible: true });
    await signIn.click();
    // The M1 flow in the landing page's dialog (D57).
    await expect(page.getByRole('dialog', { name: 'Sign in to Quad' })).toBeVisible();
    // The dialog is named by each step's title, so it is found by its marker from here on.
    const dialog = page.locator('[data-signin-dialog]');
    await expect(page).toHaveURL('/');

    // The landing page has its own Work email (the demo form), so each step is found in the dialog.
    await dialog.getByLabel('Work email').fill(PEOPLE.prishan);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(dialog.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    // The password step shows the address typed on the email step.
    await expect(dialog.getByText(PEOPLE.prishan)).toBeVisible();
    await dialog.getByLabel('Password', { exact: true }).fill(stack.seedPassword);
    await dialog.getByRole('button', { name: 'Sign in' }).click();
    await enterCode(page, stack.fixedCode);

    await expect(page).toHaveURL('/app');
    await expect(title(page, GREETING)).toBeVisible();
    expect((await brandVariable(page, '--quad-brand-raw')).toUpperCase()).toBe(CIS_BRAND);
    expect((await brandVariable(page, '--quad-brand-fill')).toLowerCase()).toBe(
      deriveBrand(CIS_BRAND, schemeOf(testInfo)).fill.toLowerCase(),
    );
    const nav = await openNav(page);
    await expect(nav.getByText(CIS)).toBeVisible();
    await expect(nav.getByText('CIS', { exact: true })).toBeVisible();
    await closeNav(page);
    await expectAccessibleOnceStill(page);
  },
);
