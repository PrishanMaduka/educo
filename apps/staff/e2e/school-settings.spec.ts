import { expect, type Page, type TestInfo } from '@playwright/test';
import {
  expectCanvas,
  expectAccessibleOnceStill,
  expectNoSideScroll,
  saveScreenshot,
  schemeOf,
  takeScreenshots,
} from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';
import { School } from '@quad/contracts';

import { PRISHAN_STATE } from './sign-in-as';

/*
 * Settings → School settings against the e2e stack (spec 08; Task 22): the summary line from the
 * API, General with the save bar, the read-only sign-in rules, and the Audit tab with its filters,
 * detail drawer and Export CSV. Every journey runs on Prishan's shared session from
 * `global-sign-in.ts`, so none signs in with a password (`PASSWORD_JOURNEY_PROJECTS` is
 * untouched). The one write, saving General, changes only the address, runs in one project (the
 * four would race on the school's version, If-Match), and puts the address back as it found it;
 * the other journeys never read the address.
 */

const PATH = '/app/settings/school';
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const title = (page: Page) => page.getByRole('heading', { level: 1, name: 'School settings' });

/** The audit log as the page shows it at this width: the table, or the list on phones. */
const entries = (page: Page) =>
  isPhone(page)
    ? page.getByRole('list', { name: 'Audit log entries' })
    : page.getByRole('table', { name: 'Audit log entries' });

/** The entries' open buttons, newest first. */
const openButtons = (page: Page) =>
  entries(page).getByRole('button', { name: /^Open the details of / });

async function pick(page: Page, filter: string, option: string) {
  await page
    .getByRole('group', { name: 'Filter the audit log' })
    .getByRole('button', { name: new RegExp(`^${filter}`) })
    .click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/**
 * Sets the school's address through the API, as the page would: the version from `GET /school`
 * as If-Match, and the CSRF cookie echoed. Works whatever state the page was left in.
 */
async function restoreAddress(page: Page, address: string) {
  const school = await page.request.get('/api/v1/school');
  expect(school.ok()).toBe(true);
  const { address: current, etag } = School.parse(await school.json());
  const wanted = address === '' ? null : address;
  if (current === wanted) return;
  const { cookies } = await page.context().storageState();
  const csrf = cookies.find((cookie) => cookie.name === 'quad_csrf')?.value ?? '';
  const saved = await page.request.patch('/api/v1/school', {
    data: { address: wanted },
    headers: { 'if-match': etag, 'x-csrf-token': csrf },
  });
  expect(saved.ok()).toBe(true);
}

/** An address no other run or project writes. */
const addressFor = (testInfo: TestInfo) =>
  `1 Test Lane, ${testInfo.project.name} r${String(testInfo.retry)}`;

test.describe('School settings, as the school admin', () => {
  test.use({ storageState: PRISHAN_STATE });

  test('General tells the story, shows what Quad sets, and passes axe', async ({
    page,
  }, testInfo) => {
    await page.goto(PATH);
    await expect(title(page)).toBeVisible();
    await expect(page.getByText(/^Ask Quad is (on|off)\. Quiet hours are /)).toBeVisible();
    await expect(page.getByLabel('School name')).toHaveValue('Colombo International School');
    const quad = page.getByRole('region', { name: 'Set by Quad' });
    await expect(quad.getByText('Asia/Colombo')).toBeVisible();
    await expect(quad.getByText(/^#[0-9A-F]{6}$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save school details' })).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectAccessibleOnceStill(page);
  });

  test('saves the address, shows it in the audit log, then puts it back', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-light', 'One project writes the school');
    const address = addressFor(testInfo);
    await page.goto(PATH);
    const field = page.getByLabel('Address');
    await expect(field).toBeVisible();
    const before = await field.inputValue();
    try {
      await field.fill(address);
      await expect(page.getByText('Unsaved changes to the school’s details')).toBeVisible();
      await page.getByRole('button', { name: 'Save school details' }).click();
      await expect(page.getByText('School details saved')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save school details' })).toHaveCount(0);

      await page.getByRole('tab', { name: 'Audit' }).click();
      await expect(page).toHaveURL(/\?tab=audit$/);
      await pick(page, 'Action', 'Changed School settings');
      await openButtons(page).first().click();
      const drawer = page.getByRole('dialog', { name: 'Changed School settings: address' });
      await expect(drawer.getByRole('row', { name: /Address/ })).toContainText(address);
      await expect(drawer.getByText('Prishan Maduka')).toBeVisible();
      await drawer.getByRole('button', { name: 'Back to the log' }).click();
      await expect(drawer).toBeHidden();
    } finally {
      // Put it back whatever happened above, so the next run starts where this one did.
      await restoreAddress(page, before);
    }
  });

  test('asks before leaving with unsaved changes, and Discard puts them back', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'The side bar is a slide-over on phones');
    await page.goto(PATH);
    const field = page.getByLabel('Office phone');
    await expect(field).toBeVisible();
    const before = await field.inputValue();
    await field.fill('011 000 0000');
    let asked = '';
    page.once('dialog', (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await page.getByRole('link', { name: 'Users & roles' }).first().click();
    await expect.poll(() => asked).toBe('You have unsaved changes. Leave this page and lose them?');
    await expect(title(page)).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await expect(field).toHaveValue(before);
  });

  test('Sign-in lists the rules, read-only', async ({ page }, testInfo) => {
    await page.goto(`${PATH}?tab=sign-in`);
    await expect(page.getByText('Managed by Quad. Ask support to change them.')).toBeVisible();
    await expect(page.getByText(/^At least \d+ characters$/)).toBeVisible();
    await expect(page.getByRole('tabpanel').getByRole('textbox')).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectAccessibleOnceStill(page);
  });

  test('Audit lists who did what, filters it, and passes axe', async ({ page }, testInfo) => {
    await page.goto(`${PATH}?tab=audit`);
    await expect(openButtons(page).first()).toBeVisible();
    // Prishan's own sign-in for this run is in the log.
    await pick(page, 'Action', 'Signed in');
    await pick(page, 'Person', 'Prishan Maduka');
    await expect(openButtons(page).first()).toHaveAccessibleName('Open the details of Signed in');
    await expect(entries(page).getByText('Prishan Maduka').first()).toBeVisible();
    await pick(page, 'When', 'Last 7 days');
    await expect(openButtons(page).first()).toBeVisible();
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectAccessibleOnceStill(page);
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
  });

  test('exports the filtered log as a CSV file', { tag: '@webkit' }, async ({ page }) => {
    await page.goto(`${PATH}?tab=audit`);
    await expect(openButtons(page).first()).toBeVisible();
    await pick(page, 'Action', 'Signed in');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    expect((await download).suggestedFilename()).toMatch(/^quad-audit-\d{4}-\d{2}-\d{2}\.csv$/);
    await expect(page.getByText('Audit log exported')).toBeVisible();
  });

  test(
    'an entry opens in a drawer, and closing it returns focus to the entry',
    { tag: '@webkit' },
    async ({ page }) => {
      await page.goto(`${PATH}?tab=audit`);
      const first = openButtons(page).first();
      await expect(first).toBeVisible();
      const name = (await first.getAttribute('aria-label')) ?? '';
      await first.click();
      const drawer = page.getByRole('dialog', {
        name: name.replace('Open the details of ', ''),
      });
      await expect(drawer.getByText('When', { exact: true })).toBeVisible();
      await expectAccessibleOnceStill(page);
      await drawer.getByRole('button', { name: 'Back to the log' }).click();
      await expect(drawer).toBeHidden();
      await expect(first).toBeFocused();
      await first.press('Enter');
      await expect(drawer).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(first).toBeFocused();
    },
  );
});

test.describe('screenshots', () => {
  test.skip(!takeScreenshots, 'Set QUAD_SCREENSHOTS=1 to write the review screenshots');
  test.use({ storageState: PRISHAN_STATE });

  // docs/screenshots/m1/school-general-1440-light.png and school-audit-<width>-<scheme>.png at
  // 1440 light and 390 dark (Task 22).
  test('School settings', async ({ page }, testInfo) => {
    const width = page.viewportSize()?.width;
    const scheme = schemeOf(testInfo);
    const wide = width === 1440 && scheme === 'light';
    test.skip(!wide && !(width === 390 && scheme === 'dark'), 'Reviewed at 1440 light, 390 dark');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (wide) {
      await page.goto(PATH);
      await expect(page.getByLabel('School name')).toBeVisible();
      await saveScreenshot(page, testInfo, 'm1', 'school-general');
    }
    await page.goto(`${PATH}?tab=audit`);
    await expect(openButtons(page).first()).toBeVisible();
    await saveScreenshot(page, testInfo, 'm1', 'school-audit');
  });
});
