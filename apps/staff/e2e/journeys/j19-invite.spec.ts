import { expect, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations } from '@quad/config/playwright/checks';
import { contextOptionsFor, test } from '@quad/config/playwright/stack';

import { PRISHAN_STATE } from '../sign-in-as';
import { inviteLinkFor, inviteeAddress } from '../staff-accounts';
import {
  enterCode,
  enterEmail,
  enterPassword,
  expectAccessibleOnceStill,
  navPages,
  openProfileMenu,
  title,
} from '../steps';

/*
 * Journey 19 (spec 17), "Users & roles invite": the school admin invites a teacher in Settings →
 * Users & roles; the invite email arrives in Mailpit; the signed link sets a password and
 * two-step; the teacher signs in with the Teacher role; the admin changes the role and the
 * teacher's menu changes; deactivating the teacher ends their session. The admin is Prishan's
 * shared session (no password call); the teacher is `new.teacher+<run>-<project>-r<retry>`, in a
 * browser context of their own, so the four projects never meet and only the invitee's role and
 * status change.
 */

const PATH = '/app/settings/users';
const isNarrowPeople = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

/** The invitee's row (or card on narrow screens) in the People list. */
function personRow(page: Page, email: string) {
  return isNarrowPeople(page)
    ? page
        .getByRole('list', { name: 'Staff accounts' })
        .getByRole('listitem')
        .filter({ hasText: email })
    : page
        .getByRole('table', { name: 'Staff accounts' })
        .getByRole('row')
        .filter({ hasText: email });
}

async function findPerson(page: Page, email: string) {
  await page.goto(PATH);
  await page.getByRole('searchbox', { name: 'Search name or email' }).fill(email);
  const row = personRow(page, email);
  await expect(row).toHaveCount(1);
  return row;
}

test.use({ storageState: PRISHAN_STATE });

test('J19: an invited teacher sets a password and two-step, signs in, changes role and is signed out when deactivated', async ({
  page,
  browser,
  stack,
}, testInfo) => {
  const email = inviteeAddress(testInfo);
  const password = `${stack.seedPassword} for the new teacher`;

  // The admin invites the teacher.
  await page.goto(PATH);
  await page.getByRole('button', { name: 'Invite staff' }).click();
  const drawer = page.getByRole('dialog', { name: 'Invite staff' });
  await drawer.getByLabel('Email addresses').fill(email);
  await expect(drawer.getByRole('combobox', { name: 'Role' })).toHaveText(/Teacher/);
  await drawer.getByRole('button', { name: 'Send invites' }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByText('Invite sent to 1 person')).toBeVisible();
  const link = await inviteLinkFor(email);

  const teacherContext = await browser.newContext(contextOptionsFor(testInfo, 'teacher'));
  try {
    const teacher = await teacherContext.newPage();

    // The signed link: a password, then two-step with the key read from the page.
    await teacher.goto(new URL(link).pathname);
    await expect(title(teacher, 'Join Colombo International School on Quad')).toBeVisible();
    await expectAccessibleOnceStill(teacher);
    await teacher.getByLabel('Choose a password').fill(password);
    await teacher.getByRole('button', { name: 'Accept and set up my account' }).click();
    await expect(title(teacher, 'Turn on two-step sign-in')).toBeVisible();
    const key = (await teacher.locator('code').first().textContent())?.replace(/\s/g, '') ?? '';
    expect(key).toMatch(/^[A-Z2-7]{16,}$/);
    await teacher.getByRole('textbox', { name: 'Digit 1 of 6' }).click();
    await teacher.keyboard.type(stack.fixedCode);
    await expect(title(teacher, 'Save your recovery codes')).toBeVisible();
    await teacher.getByRole('button', { name: 'I’ve saved them, continue' }).click();
    await expect(teacher).toHaveURL('/app/teaching');

    // They sign in again with the new password, as a Teacher.
    const profile = await openProfileMenu(teacher);
    await profile.getByRole('button', { name: 'Sign out' }).click();
    await expect(teacher).toHaveURL('/sign-in');
    await enterEmail(teacher, email);
    await enterPassword(teacher, password);
    await enterCode(teacher, stack.fixedCode);
    await expect(teacher).toHaveURL('/app/teaching');
    const teacherMenu = await navPages(teacher);
    expect(teacherMenu).toContain('My teaching');
    expect(teacherMenu).not.toContain('Users & roles');
    await expectNoSeriousA11yViolations(teacher);

    // The admin makes them Front desk: after a reload their menu is Front desk's.
    let row = await findPerson(page, email);
    await expect(row.getByText('Active', { exact: true })).toBeVisible();
    await row.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Front desk', exact: true }).click();
    await expect(page.getByText(/ is now Front desk$/)).toBeVisible();
    await teacher.goto('/app');
    await expect(teacher).not.toHaveURL(/\/sign-in/);
    const frontDeskMenu = await navPages(teacher);
    expect(frontDeskMenu).not.toEqual(teacherMenu);
    expect(frontDeskMenu).not.toContain('My teaching');

    // Deactivating them ends their session: the next page goes to sign-in.
    row = await findPerson(page, email);
    await row.getByRole('button', { name: /^More actions for / }).click();
    await page.getByRole('button', { name: 'Deactivate' }).click();
    await page
      .getByRole('dialog', { name: /^Deactivate .+\?$/ })
      .getByRole('button', { name: /^Deactivate / })
      .click();
    await expect(page.getByText(/can no longer sign in$/)).toBeVisible();
    await teacher.goto('/app');
    await expect(teacher).toHaveURL('/sign-in?next=%2Fapp');
  } finally {
    await teacherContext.close();
  }
});
