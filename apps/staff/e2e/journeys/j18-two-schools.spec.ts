import { expect } from '@playwright/test';
import { schemeOf } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';
import { deriveBrand } from '@quad/tokens';

import { PASSWORD_JOURNEY_PROJECTS, PEOPLE } from '../sign-in-as';
import {
  brandVariable,
  closeNav,
  enterCode,
  enterEmail,
  enterPassword,
  expectAccessibleOnceStill,
  openNav,
  openProfileMenu,
  sessionCookie,
  title,
} from '../steps';

/*
 * Journey 18 (spec 17), "Sign-in, two schools": Ruwan signs in, sees Choose a school with both
 * schools and his role in each, picks Kandy Hill Academy and sees its branding; Switch school in
 * the profile menu rotates the session (the cookie's value changes) and opens Colombo
 * International School. It replaces the Task 19 Choose a school and Task 20 Switch school
 * journeys, so Ruwan's password calls per run stay at 2 × 3 (`PASSWORD_JOURNEY_PROJECTS`). Only
 * Ruwan's own session is touched.
 */

const CIS = 'Colombo International School';
const KHA = 'Kandy Hill Academy';

test(
  'J18: Ruwan chooses Kandy Hill Academy, then Switch school rotates the session into Colombo International',
  { tag: '@webkit' },
  async ({ page, playwright, stack }, testInfo) => {
    test.skip(
      !PASSWORD_JOURNEY_PROJECTS.includes(testInfo.project.name),
      'Ruwan signs in with a password: see PASSWORD_JOURNEY_PROJECTS for the per-email limit',
    );
    const scheme = schemeOf(testInfo);
    await page.goto('/sign-in');
    await enterEmail(page, PEOPLE.ruwan);
    await enterPassword(page, stack.seedPassword);
    await enterCode(page, stack.fixedCode);

    await expect(title(page, 'Choose a school')).toBeVisible();
    await expect(
      page.getByText(`${PEOPLE.ruwan} is linked to 2 schools on Quad.`, { exact: false }),
    ).toBeVisible();
    for (const school of [CIS, KHA]) {
      const choice = page.getByRole('button', { name: new RegExp(school) });
      await expect(choice).toBeVisible();
      await expect(choice).toContainText('Teacher');
    }
    await expectAccessibleOnceStill(page);
    await page.getByRole('button', { name: new RegExp(KHA) }).click();

    // A teacher's home is My teaching (Task 20).
    await expect(page).toHaveURL('/app/teaching');
    await expect(page.getByText('My teaching arrives soon')).toBeVisible();
    expect((await brandVariable(page, '--quad-brand-raw')).toUpperCase()).toBe('#2BB0A0');
    expect((await brandVariable(page, '--quad-brand-fill')).toLowerCase()).toBe(
      deriveBrand('#2BB0A0', scheme).fill.toLowerCase(),
    );
    const nav = await openNav(page);
    await expect(nav.getByText(KHA)).toBeVisible();
    await closeNav(page);
    await expectAccessibleOnceStill(page);

    // Kandy Hill's plan has no transport, so Routes names the plan, not the Teacher role (D52).
    await page.goto('/app/transport/routes');
    await expect(title(page, 'Routes isn’t included in your school’s plan')).toBeVisible();
    await expect(
      page.getByText(
        'Your school’s plan doesn’t include this. Ask Quad support if you’d like to add it.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to My teaching' })).toBeVisible();
    await expectAccessibleOnceStill(page);

    const before = await sessionCookie(page);
    expect(before).toBeDefined();
    const menu = await openProfileMenu(page);
    await expect(menu.getByText('Switch school')).toBeVisible();
    const reloaded = page.waitForURL('/app/teaching');
    await menu.getByRole('button', { name: CIS }).click();
    await reloaded;
    await expect(page.getByText('My teaching arrives soon')).toBeVisible();
    expect((await brandVariable(page, '--quad-brand-raw')).toUpperCase()).toBe('#DD4A42');
    expect((await brandVariable(page, '--quad-brand-fill')).toLowerCase()).toBe(
      deriveBrand('#DD4A42', scheme).fill.toLowerCase(),
    );
    const after = await sessionCookie(page);
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
    const navAfter = await openNav(page);
    await expect(navAfter.getByText(CIS)).toBeVisible();
    await closeNav(page);
    await expectAccessibleOnceStill(page);

    // The old cookie no longer opens anything (a request of its own, with only that cookie).
    const old = await playwright.request.newContext({
      baseURL: testInfo.project.use.baseURL,
      extraHTTPHeaders: { cookie: `quad_sid=${before ?? ''}` },
    });
    try {
      expect((await old.get('/api/v1/me')).status()).toBe(401);
    } finally {
      await old.dispose();
    }
  },
);
