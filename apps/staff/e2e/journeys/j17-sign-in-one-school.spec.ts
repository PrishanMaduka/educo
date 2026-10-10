import { expect, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations, schemeOf } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';
import { deriveBrand } from '@quad/tokens';

import { PASSWORD_JOURNEY_PROJECTS, PEOPLE } from '../sign-in-as';
import {
  GREETING,
  brandVariable,
  closeNav,
  enterCode,
  enterEmail,
  enterPassword,
  expectAccessibleOnceStill,
  openNav,
  title,
} from '../steps';

/*
 * Journey 17 (spec 17), "Sign-in, one school": Prishan opens Sign in on the landing page, enters
 * her email, password and the code 000000, and lands in /app with Colombo International School's
 * name and colour. The landing here is the normal build (NEXT_PUBLIC_QUAD_PRELAUNCH unset), whose
 * Sign in is a link to /app, which sends a signed-out visitor to /sign-in?next=/app (D30); the
 * pre-launch export's coming-soon note is `landing.spec.ts`'s. CIS has no logo in the seed, so its
 * tile is its short name on its brand fill. The brand is the shell's `--school-brand` variable
 * (Task 20; the plan's `--brand`), the seed's #DD4A42. One password call per run of it for
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
      .getByRole('link', { name: 'Sign in', exact: true })
      .filter({ visible: true });
    await expect(signIn).toHaveAttribute('href', '/app');
    await signIn.click();
    await expect(page).toHaveURL('/sign-in?next=%2Fapp');
    await expect(title(page, 'Sign in to Quad')).toBeVisible();
    await expectAccessibleOnceStill(page);

    await enterEmail(page, PEOPLE.prishan);
    await enterPassword(page, stack.seedPassword);
    await enterCode(page, stack.fixedCode);

    await expect(page).toHaveURL('/app');
    await expect(title(page, GREETING)).toBeVisible();
    expect((await brandVariable(page, '--school-brand')).toUpperCase()).toBe(CIS_BRAND);
    expect((await brandVariable(page, '--quad-brand-fill')).toLowerCase()).toBe(
      deriveBrand(CIS_BRAND, schemeOf(testInfo)).brandFill.toLowerCase(),
    );
    const nav = await openNav(page);
    await expect(nav.getByText(CIS)).toBeVisible();
    await expect(nav.getByText('CIS', { exact: true })).toBeVisible();
    await closeNav(page);
    await expectNoSeriousA11yViolations(page);
  },
);
