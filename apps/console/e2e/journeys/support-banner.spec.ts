import { expect } from '@playwright/test';
import { expectAccessibleOnceStill, expectNoSideScroll } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { QUAD_STAFF, SUPPORT_STATE } from '../sign-in-as';

/*
 * The support banner (M1 acceptance, spec 05 → Support access): Quad support opens Colombo
 * International School as school admin with a reason; the staff portal (its own build on :3000,
 * against the same stack, started by this config) shows the support banner; Exit to platform
 * ends the visit and returns to the console. Each test opens a visit of its own from Quad
 * support's shared console session (`SUPPORT_STATE`, no password call), which a visit leaves as it
 * is.
 */

const SCHOOL = 'Colombo International School';
const OPEN_AS = `Open ${SCHOOL} as school admin`;
const STAFF = 'http://localhost:3000';
const CONSOLE = 'http://localhost:3001';
const BANNER = `Support view: you’re in ${SCHOOL} as ${QUAD_STAFF.support.name} from Quad. Everything you do here is logged in the school’s audit log.`;

test.use({ storageState: SUPPORT_STATE });

test('Quad support opens a school with a reason, sees the support banner, and Exit to platform returns to the console', async ({
  page,
}, testInfo) => {
  await page.goto('/schools');
  await page.getByRole('button', { name: OPEN_AS }).filter({ visible: true }).first().click();
  const drawer = page.getByRole('dialog', { name: OPEN_AS });
  await drawer
    .getByRole('textbox', { name: 'Why are you opening this school?' })
    .fill(`e2e ${testInfo.project.name}: checking the support banner journey for the school`);
  await drawer.getByRole('button', { name: OPEN_AS }).click();

  // The single-use link opens the portal as the school's admin, under the support banner.
  await page.waitForURL(`${STAFF}/app`);
  const banner = page.getByRole('status').filter({ hasText: 'Support view' });
  await expect(banner.getByText(BANNER, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSideScroll(page);
  await expectAccessibleOnceStill(page);

  await banner.getByRole('button', { name: 'Exit to platform' }).click();
  await page.waitForURL(`${CONSOLE}/`);
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await expectAccessibleOnceStill(page);

  // The visit is over: the portal no longer opens with its cookie.
  await page.goto(`${STAFF}/app`);
  await expect(page).toHaveURL(`${STAFF}/sign-in?next=%2Fapp`);
});
