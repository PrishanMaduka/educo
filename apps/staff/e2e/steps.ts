import { expect, type Page } from '@playwright/test';

/*
 * The page steps the staff journeys share: the sign-in card's steps and the signed-in shell's
 * menus. Each waits on what the page shows, never on time.
 */

export const GREETING = /^(Good morning|Good afternoon|Good evening|Hello), Prishan$/;

/** Text matched literally inside a RegExp. */
const literal = (text: string) => text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

/** The /app greeting for someone whose first name is `firstName`. */
export const greetingFor = (firstName: string) =>
  new RegExp(`^(Good morning|Good afternoon|Good evening|Hello), ${literal(firstName)}$`);

export const title = (page: Page, name: string | RegExp) =>
  page.getByRole('heading', { level: 1, name });

/** Phones (and small tablets) get the slide-over menu instead of the rail. */
export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 900;

export async function enterEmail(page: Page, email: string): Promise<void> {
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(title(page, 'Welcome back')).toBeVisible();
}

export async function enterPassword(page: Page, password: string): Promise<void> {
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Types the code into the six boxes; the step sends it once the last box is filled. */
export async function enterCode(page: Page, code: string): Promise<void> {
  await expect(title(page, 'Two-step sign-in')).toBeVisible();
  await page.getByRole('textbox', { name: 'Digit 1 of 6' }).click();
  await page.keyboard.type(code);
}

/** axe once nothing moves (shared with the console). */
export { expectAccessibleOnceStill } from '@quad/config/playwright/checks';

/** The side bar's navigation: the rail on desktop, the slide-over menu on phones. */
export async function openNav(page: Page) {
  if (!isPhone(page)) return page.getByRole('complementary', { name: 'Side bar' });
  await page.getByRole('button', { name: 'Open menu' }).click();
  return page.getByRole('dialog', { name: 'Menu' });
}

/** Closes the phone menu `openNav` opened (the rail needs nothing). */
export async function closeNav(page: Page): Promise<void> {
  if (isPhone(page)) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  }
}

/**
 * The page links in the navigation, in order, as their names. It waits for the menu to show a
 * link first, so a menu that has not rendered yet never reads as an empty one.
 */
export async function navPages(page: Page): Promise<string[]> {
  const nav = await openNav(page);
  const links = nav.getByRole('navigation').getByRole('link');
  await expect(links.first()).toBeVisible();
  const names = await links.evaluateAll((all) => all.map((link) => link.textContent.trim()));
  await closeNav(page);
  return names;
}

/**
 * The audit log's entries on Settings → Audit: the table's rows from 768 px, the list's items
 * below it.
 */
export const auditEntries = (page: Page) =>
  (page.viewportSize()?.width ?? 0) < 768
    ? page.getByRole('list', { name: 'Audit log entries' }).getByRole('listitem')
    : page.getByRole('table', { name: 'Audit log entries' }).getByRole('row');

export async function openProfileMenu(page: Page) {
  await page.getByRole('button', { name: 'Open your profile menu' }).click();
  return page.getByRole('dialog', { name: 'Your profile' });
}

/** The value a CSS variable resolves to inside the shell's school-brand scope. */
export const brandVariable = (page: Page, name: string) =>
  page
    .locator('[data-school-brand]')
    .first()
    .evaluate(
      (element, variable) => getComputedStyle(element).getPropertyValue(variable).trim(),
      name,
    );

/** The session cookie's value in the page's context (`quad_sid` locally). */
export async function sessionCookie(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => /^(__Host-)?quad_sid$/.test(cookie.name))?.value;
}
