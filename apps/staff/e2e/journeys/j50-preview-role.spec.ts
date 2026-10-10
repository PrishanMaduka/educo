import { expect, type Page } from '@playwright/test';
import { contextOptionsFor, test } from '@quad/config/playwright/stack';
import { Me } from '@quad/contracts';

import { PRISHAN_STATE, signInThroughApi } from '../sign-in-as';
import { createStaffMember, inviteeAddress, setUpTwoStep } from '../staff-accounts';
import {
  auditEntries,
  expectAccessibleOnceStill,
  greetingFor,
  isPhone,
  navPages,
  openProfileMenu,
  title,
} from '../steps';

/*
 * Journey 50 (spec 17), "Preview a role": the school admin previews Finance officer; the menu
 * shows only Dashboard, Communications, Students, Fees & invoicing and Accounting; Students is
 * View only; Timetable shows the no-access page; a write during the preview is 403
 * `preview_read_only`; Back to my view restores the admin's menu; the audit log has the start and
 * the end. It also keeps Task 20's View as Teacher steps (the banner, the sample, Back to my view
 * in the profile menu), which run on desktop only: spec 08 puts the View as picker in the top
 * bar on desktop. The Preview a role card works at every width.
 *
 * A preview changes the session, so the admin is a School admin this test invites (from
 * Prishan's shared session, no password call) and signs in: one password call for an address of
 * its own per project, retry and run, and none for Prishan.
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
  browser,
  stack,
}, testInfo) => {
  test.slow();
  const email = inviteeAddress(testInfo, 'preview.admin');
  const prishan = await browser.newContext(contextOptionsFor(testInfo, 'prishan', PRISHAN_STATE));
  try {
    await createStaffMember(prishan.request, page.request, {
      email,
      role: 'School admin',
      password: stack.seedPassword,
    });
  } finally {
    await prishan.close();
  }
  await setUpTwoStep(page.request);
  await page.context().clearCookies();
  await signInThroughApi(page.request, email);
  const me = Me.parse(await (await page.request.get('/api/v1/me')).json());
  const greeting = greetingFor(me.person.firstName);

  await page.goto('/app');
  await expect(title(page, greeting)).toBeVisible();
  const ownMenu = await navPages(page);
  expect(ownMenu).toContain('Users & roles');

  if (!isPhone(page)) {
    // View as Teacher (Task 20): the banner names the sample, and the menu loses Users & roles.
    await page.getByRole('combobox', { name: 'View as role' }).click();
    await page.getByRole('option', { name: 'View as: Teacher' }).click();
    await expect(page).toHaveURL('/app/teaching');
    const teacherBanner = page.getByRole('status').filter({ hasText: 'Previewing as Teacher' });
    await expect(teacherBanner).toContainText(/Previewing as Teacher · \S+/);
    expect(await navPages(page)).not.toContain('Users & roles');
    await expectAccessibleOnceStill(page);
    await page.goto('/app/settings/users');
    await expect(title(page, 'Users & roles isn’t part of the Teacher role')).toBeVisible();
    // Switch school is a write the preview refuses: the menu offers Back to my view instead.
    const menu = await openProfileMenu(page);
    await expect(menu.getByRole('button', { name: 'Back to my view' })).toBeVisible();
    await page.keyboard.press('Escape');
    await teacherBanner.getByRole('button', { name: 'Back to my view' }).click();
    await expect(page).toHaveURL('/app');
    await expect(title(page, greeting)).toBeVisible();
    await expect(page.getByText('Previewing as')).toHaveCount(0);
  }

  // Finance officer, from the Preview a role card on Users & roles (Task 21).
  await page.goto('/app/settings/users');
  const card = page.getByRole('region', { name: 'Preview a role' });
  await expect(card.getByText(/· opens on My teaching$/).first()).toBeVisible();
  await card.getByRole('button', { name: 'Preview as Finance officer' }).click();
  await expect(page).toHaveURL('/app');
  const banner = page.getByRole('status').filter({ hasText: 'Previewing as Finance officer' });
  await expect(banner).toBeVisible();
  expect(await navPages(page)).toEqual(FINANCE_MENU);
  await expectAccessibleOnceStill(page);

  await page.goto('/app/students');
  await expect(title(page, 'Students')).toBeVisible();
  await expect(page.getByText('View only', { exact: true })).toBeVisible();
  await expectAccessibleOnceStill(page);

  await page.goto('/app/timetable');
  await expect(title(page, 'Timetable isn’t part of the Finance officer role')).toBeVisible();
  await expectAccessibleOnceStill(page);

  const write = await patchMeFromPage(page);
  expect(write.sentCsrf).toBe(true);
  expect(write.status).toBe(403);
  expect(write.body).toMatchObject({ code: 'preview_read_only' });

  await page.goto('/app');
  await banner.getByRole('button', { name: 'Back to my view' }).click();
  await expect(page).toHaveURL('/app');
  await expect(title(page, greeting)).toBeVisible();
  await expect(page.getByText('Previewing as')).toHaveCount(0);
  expect(await navPages(page)).toEqual(ownMenu);

  // Settings → Audit has this admin's start and end (other projects' admins write there too).
  for (const [action, summary] of [
    ['Started a role preview', 'Started previewing the role Finance officer'],
    ['Ended a role preview', 'Stopped previewing the role Finance officer'],
  ] as const) {
    await page.goto('/app/settings/school?tab=audit');
    await filterAuditBy(page, action);
    await expect(
      auditEntries(page)
        .filter({ hasText: me.person.name })
        .getByRole('button', { name: `Open the details of ${summary}` })
        .first(),
    ).toBeVisible();
    await expectAccessibleOnceStill(page);
  }
});
