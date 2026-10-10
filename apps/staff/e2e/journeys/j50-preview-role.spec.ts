import { expect, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations } from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { PEOPLE, signInThroughApi } from '../sign-in-as';
import { GREETING, isPhone, navPages, openProfileMenu, title } from '../steps';

/*
 * Journey 50 (spec 17), "Preview a role": the school admin previews Finance officer; the menu
 * shows only Dashboard, Communications, Students, Fees & invoicing and Accounting; Students is
 * View only; Timetable shows the no-access page; a write during the preview is 403
 * `preview_read_only`; Back to my view restores the admin's menu; the audit log has the start and
 * the end. It also keeps Task 20's View as Teacher steps (the banner, the sample, Back to my view
 * in the profile menu), in the same session. A preview changes the session, so Prishan signs in
 * on her own here, in one project (View as is desktop only, spec 08): 2 of her password calls per
 * run at worst (`PASSWORD_JOURNEY_PROJECTS`).
 */

const FINANCE_MENU = [
  'Dashboard',
  'Communications',
  'Students',
  'Fees & invoicing',
  'Accounting',
] as const;

/** A write from the page itself, as the portal sends one: the CSRF cookie echoed. */
const patchMeFromPage = (page: Page) =>
  page.evaluate(async () => {
    const csrf = document.cookie
      .split('; ')
      .find((pair) => pair.startsWith('quad_csrf='))
      ?.slice('quad_csrf='.length);
    const response = await fetch('/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf ?? '' },
      body: JSON.stringify({ theme: 'dark' }),
    });
    const body: unknown = await response.json();
    return { status: response.status, body, sentCsrf: csrf !== undefined };
  });

async function filterAuditBy(page: Page, action: string) {
  await page
    .getByRole('group', { name: 'Filter the audit log' })
    .getByRole('button', { name: /^Action/ })
    .click();
  await page.getByRole('option', { name: action, exact: true }).click();
}

test('J50: the school admin previews Finance officer, cannot write, and goes back to their own view', async ({
  page,
}, testInfo) => {
  test.skip(isPhone(page), 'View as is in the top bar on desktop only (spec 08)');
  test.skip(
    testInfo.project.name !== 'desktop-light',
    'Prishan signs in with a password: one project only, see PASSWORD_JOURNEY_PROJECTS for the per-email limit',
  );
  await signInThroughApi(page.request, PEOPLE.prishan);
  await page.goto('/app');
  await expect(title(page, GREETING)).toBeVisible();
  const ownMenu = await navPages(page);
  expect(ownMenu).toContain('Users & roles');

  // View as Teacher (Task 20): the banner names the sample, and the menu loses Users & roles.
  await page.getByRole('combobox', { name: 'View as role' }).click();
  await page.getByRole('option', { name: 'View as: Teacher' }).click();
  await expect(page).toHaveURL('/app/teaching');
  const teacherBanner = page.getByRole('status').filter({ hasText: 'Previewing as Teacher' });
  await expect(teacherBanner).toContainText(/Previewing as Teacher · \S+/);
  expect(await navPages(page)).not.toContain('Users & roles');
  await page.goto('/app/settings/users');
  await expect(title(page, 'Users & roles isn’t part of the Teacher role')).toBeVisible();
  // Switch school is a write the preview refuses: the menu offers Back to my view instead.
  const menu = await openProfileMenu(page);
  await expect(menu.getByRole('button', { name: 'Back to my view' })).toBeVisible();
  await page.keyboard.press('Escape');
  await teacherBanner.getByRole('button', { name: 'Back to my view' }).click();
  await expect(page).toHaveURL('/app');
  await expect(page.getByText('Previewing as')).toHaveCount(0);

  // Finance officer, from the Preview a role card on Users & roles (Task 21).
  await page.goto('/app/settings/users');
  const card = page.getByRole('region', { name: 'Preview a role' });
  await expect(card.getByText(/· opens on My teaching$/).first()).toBeVisible();
  await card.getByRole('button', { name: 'Preview as Finance officer' }).click();
  await expect(page).toHaveURL('/app');
  const banner = page.getByRole('status').filter({ hasText: 'Previewing as Finance officer' });
  await expect(banner).toBeVisible();
  expect(await navPages(page)).toEqual(FINANCE_MENU);
  await expectNoSeriousA11yViolations(page);

  await page.goto('/app/students');
  await expect(title(page, 'Students')).toBeVisible();
  await expect(page.getByText('View only', { exact: true })).toBeVisible();

  await page.goto('/app/timetable');
  await expect(title(page, 'Timetable isn’t part of the Finance officer role')).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  const write = await patchMeFromPage(page);
  expect(write.sentCsrf).toBe(true);
  expect(write.status).toBe(403);
  expect(write.body).toMatchObject({ code: 'preview_read_only' });

  await page.goto('/app');
  await banner.getByRole('button', { name: 'Back to my view' }).click();
  await expect(page).toHaveURL('/app');
  await expect(title(page, GREETING)).toBeVisible();
  await expect(page.getByText('Previewing as')).toHaveCount(0);
  expect(await navPages(page)).toEqual(ownMenu);

  // Settings → Audit has the start and the end (the newest of each is Finance officer's).
  for (const [action, summary] of [
    ['Started a role preview', 'Started previewing the role Finance officer'],
    ['Ended a role preview', 'Stopped previewing the role Finance officer'],
  ] as const) {
    await page.goto('/app/settings/school?tab=audit');
    await filterAuditBy(page, action);
    await expect(
      page
        .getByRole('table', { name: 'Audit log entries' })
        .getByRole('button', { name: /^Open the details of / })
        .first(),
    ).toHaveAccessibleName(`Open the details of ${summary}`);
  }
});
