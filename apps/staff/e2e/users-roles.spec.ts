import { expect, type Page, type TestInfo } from '@playwright/test';
import {
  expectCanvas,
  expectNoSeriousA11yViolations,
  expectNoSideScroll,
  saveScreenshot,
  schemeOf,
  takeScreenshots,
} from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { PRISHAN_STATE } from './sign-in-as';

/*
 * Settings → Users & roles against the e2e stack (spec 08; Task 21): the story from the API, the
 * People table (cards on phones), Invite staff, row actions with Deactivate's confirmation, the
 * Roles & permissions matrix with built-in roles locked, and New role. Every journey runs on
 * Prishan's shared session from `global-sign-in.ts`, so none signs in with a password (the
 * per-email limit in `PASSWORD_JOURNEY_PROJECTS` is untouched) and none changes a seeded person:
 * the writes are on people each test invites, or on a role it creates, named after its project
 * and retry so the four projects never meet. Preview a role changes the session, so it is part of
 * the shell's own Preview a role journey (`shell-auth.spec.ts`).
 */

const PATH = '/app/settings/users';
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
const title = (page: Page) => page.getByRole('heading', { level: 1, name: 'Users & roles' });

/** A fictional address no other test or project uses. */
const addressFor = (testInfo: TestInfo, who: string) =>
  `${who}.${testInfo.project.name}.r${String(testInfo.retry)}@colombo-intl.local`;

/** The people list as the page shows it at this width: the table, or the cards on phones. */
const people = (page: Page) =>
  isPhone(page)
    ? page.getByRole('list', { name: 'Staff accounts' })
    : page.getByRole('table', { name: 'Staff accounts' });

/** One person's row (or card), found by the address under their name. */
const personRow = (page: Page, email: string) =>
  isPhone(page)
    ? people(page).getByRole('listitem').filter({ hasText: email })
    : people(page).getByRole('row').filter({ hasText: email });

async function invite(page: Page, emails: readonly string[], role = 'Teacher') {
  await page.getByRole('button', { name: 'Invite staff' }).click();
  const drawer = page.getByRole('dialog', { name: 'Invite staff' });
  await drawer.getByLabel('Email addresses').fill(emails.join(', '));
  if (role !== 'Teacher') {
    await drawer.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: role, exact: true }).click();
  }
  await drawer.getByRole('button', { name: 'Send invites' }).click();
  await expect(drawer).toBeHidden();
}

async function search(page: Page, text: string) {
  await page.getByRole('searchbox', { name: 'Search name or email' }).fill(text);
}

test.describe('Users & roles, as the school admin', () => {
  test.use({ storageState: PRISHAN_STATE });

  test('People tells the story, lists the staff and passes axe', async ({ page }, testInfo) => {
    await page.goto(PATH);
    await expect(title(page)).toBeVisible();
    await expect(page.getByText(/^\d+ staff · /)).toBeVisible();
    await expect(people(page)).toBeVisible();
    const prishan = personRow(page, 'prishan.maduka@colombo-intl.local');
    await expect(prishan.getByText('You', { exact: true })).toBeVisible();
    await expect(prishan.getByRole('combobox', { name: 'Role for Prishan Maduka' })).toBeDisabled();
    await expect(page.getByRole('region', { name: 'Preview a role' })).toBeVisible();
    await expect(page.getByText(/Sign in as/)).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectNoSeriousA11yViolations(page);
  });

  test('search and role chips narrow the list', async ({ page }) => {
    await page.goto(PATH);
    await expect(people(page)).toBeVisible();
    await search(page, 'nadeesha');
    await expect(personRow(page, 'nadeesha.jayasinghe@colombo-intl.local')).toBeVisible();
    await expect(personRow(page, 'prishan.maduka@colombo-intl.local')).toHaveCount(0);
    await search(page, '');
    await page
      .getByRole('group', { name: 'Show people with the role' })
      .getByRole('button', { name: /^Finance officer/ })
      .click();
    await expect(personRow(page, 'dilini.fernando@colombo-intl.local')).toBeVisible();
    await expect(personRow(page, 'nadeesha.jayasinghe@colombo-intl.local')).toHaveCount(0);
  });

  test('invites two people at once, and they show as invited', async ({ page }, testInfo) => {
    const emails = [addressFor(testInfo, 'invite.one'), addressFor(testInfo, 'invite.two')];
    await page.goto(PATH);
    await expect(people(page)).toBeVisible();
    await invite(page, emails);
    await expect(page.getByText('Invite sent to 2 people')).toBeVisible();
    await search(page, `${testInfo.project.name}.r${String(testInfo.retry)}`);
    for (const email of emails) {
      const row = personRow(page, email);
      await expect(row.getByText('Invited', { exact: true })).toBeVisible();
      await expect(row.getByText(/^Invite sent/)).toBeVisible();
    }
  });

  test('a refused address is named in the drawer', async ({ page }) => {
    await page.goto(PATH);
    await expect(people(page)).toBeVisible();
    await page.getByRole('button', { name: 'Invite staff' }).click();
    const drawer = page.getByRole('dialog', { name: 'Invite staff' });
    await drawer.getByLabel('Email addresses').fill('nadeesha.jayasinghe@colombo-intl.local');
    await drawer.getByRole('button', { name: 'Send invites' }).click();
    await expect(
      drawer.getByText(
        'nadeesha.jayasinghe@colombo-intl.local: This person is already a member of staff here.',
      ),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test(
    'resends an invite, changes the role, and deactivates only after confirming',
    { tag: '@webkit' },
    async ({ page }, testInfo) => {
      const email = addressFor(testInfo, 'row.actions');
      await page.goto(PATH);
      await expect(people(page)).toBeVisible();
      await invite(page, [email]);
      await search(page, email);
      const row = personRow(page, email);
      await expect(row).toHaveCount(1);

      await row.getByRole('button', { name: 'Resend invite' }).click();
      await expect(page.getByText(`Invite resent to ${email}`)).toBeVisible();

      const name = (await row.getByRole('combobox').getAttribute('aria-label'))?.replace(
        /^Role for /,
        '',
      );
      await row.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Front desk', exact: true }).click();
      await expect(page.getByText(`${name ?? ''} is now Front desk`)).toBeVisible();

      const more = row.getByRole('button', { name: /^More actions for / });
      await more.click();
      await page.getByRole('button', { name: 'Deactivate' }).click();
      const drawer = page.getByRole('dialog', { name: /^Deactivate .+\?$/ });
      await expect(drawer).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      // Cancel keeps them, and focus goes back to the menu button.
      await drawer.getByRole('button', { name: 'Cancel' }).click();
      await expect(drawer).toBeHidden();
      await expect(more).toBeFocused();
      await expect(row.getByText('Invited', { exact: true })).toBeVisible();

      await more.click();
      await page.getByRole('button', { name: 'Deactivate' }).click();
      await page
        .getByRole('dialog', { name: /^Deactivate .+\?$/ })
        .getByRole('button', { name: /^Deactivate / })
        .click();
      await expect(page.getByText(/can no longer sign in$/)).toBeVisible();
      await expect(row.getByText('Deactivated', { exact: true })).toBeVisible();
    },
  );

  test('Roles & permissions locks a built-in role and passes axe', async ({ page }, testInfo) => {
    await page.goto(`${PATH}?tab=roles`);
    await expect(page.getByRole('tab', { name: 'Roles & permissions' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page
      .getByRole('group', { name: 'Roles' })
      .getByRole('button', { name: /^Teacher/ })
      .click();
    const matrix = page.getByRole('table', { name: 'What Teacher can do' });
    await expect(matrix).toBeVisible();
    const editLms = matrix.getByRole('checkbox', { name: 'Edit in LMS & gradebook' });
    await expect(editLms).toBeChecked();
    await expect(editLms).toBeDisabled();
    await expect(page.getByText(/^Built-in role\./)).toBeVisible();
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectNoSeriousA11yViolations(page);
  });

  test('creates a role from Teacher, then edits it with the save bar', async ({
    page,
  }, testInfo) => {
    const name = `Year lead ${testInfo.project.name} r${String(testInfo.retry)}`;
    await page.goto(`${PATH}?tab=roles`);
    await page.getByRole('link', { name: 'New role' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'New role' })).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoSeriousA11yViolations(page);

    await page.getByLabel('Role name').fill(name);
    await page.getByRole('radio', { name: 'Teal' }).click();
    const matrix = page.getByRole('table', { name: 'What New role can do' });
    // Started from Teacher: its LMS row, and Approve also ticks View (spec 05).
    await expect(matrix.getByRole('checkbox', { name: 'Edit in LMS & gradebook' })).toBeChecked();
    await matrix.getByRole('checkbox', { name: 'Approve in Attendance' }).click();
    await page.getByRole('button', { name: 'Create role' }).click();

    await expect(page.getByText(`${name} created`)).toBeVisible();
    await expect(page).toHaveURL(/\/app\/settings\/users\?tab=roles&role=/);
    const saved = page.getByRole('table', { name: `What ${name} can do` });
    await expect(saved.getByRole('checkbox', { name: 'Approve in Attendance' })).toBeChecked();

    await saved.getByRole('checkbox', { name: 'View in Fees & invoicing' }).click();
    await expect(page.getByText(`Unsaved changes to ${name}`)).toBeVisible();
    // Unsaved changes hold the page: People waits until they are saved or discarded.
    await page.getByRole('tab', { name: 'People' }).click();
    await expect(page.getByText('Save or discard your changes first')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Roles & permissions' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(`Permissions for ${name} saved`)).toBeVisible();
    await expect(page.getByText(`Unsaved changes to ${name}`)).toHaveCount(0);
    await page.reload();
    await expect(
      page
        .getByRole('table', { name: `What ${name} can do` })
        .getByRole('checkbox', { name: 'View in Fees & invoicing' }),
    ).toBeChecked();
  });
});

test.describe('screenshots', () => {
  test.skip(!takeScreenshots, 'Set QUAD_SCREENSHOTS=1 to write the review screenshots');
  test.use({ storageState: PRISHAN_STATE });

  // docs/screenshots/m1/users-people-<width>-<scheme>.png at 1440 light and 390 dark, and
  // users-roles-1440-light.png (Task 21).
  test('Users & roles', async ({ page }, testInfo) => {
    const width = page.viewportSize()?.width;
    const scheme = schemeOf(testInfo);
    const wide = width === 1440 && scheme === 'light';
    test.skip(!wide && !(width === 390 && scheme === 'dark'), 'Reviewed at 1440 light, 390 dark');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(PATH);
    await expect(people(page)).toBeVisible();
    await saveScreenshot(page, testInfo, 'm1', 'users-people');
    if (!wide) return;
    await page.goto(`${PATH}?tab=roles`);
    await page
      .getByRole('group', { name: 'Roles' })
      .getByRole('button', { name: /^Teacher/ })
      .click();
    await expect(page.getByRole('table', { name: 'What Teacher can do' })).toBeVisible();
    await saveScreenshot(page, testInfo, 'm1', 'users-roles');
  });
});
