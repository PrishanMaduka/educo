import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  expectNoSeriousA11yViolations,
  expectNoSideScroll,
  schemeOf,
} from '@quad/config/playwright/checks';

/*
 * The public landing page (spec 19). Runs against the staff app's server build and, through
 * playwright.export.config.ts, against the pre-launch static export (project metadata `prelaunch`).
 */
const isPrelaunch = (testInfo: TestInfo) => testInfo.project.metadata.prelaunch === true;
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) <= 900;

/** Palette B canvas (spec 19): Sky blue in light, Soft charcoal in dark. */
const CANVAS = { light: 'rgb(238, 245, 251)', dark: 'rgb(24, 24, 29)' } as const;

test.describe('landing page', () => {
  test('tells the story: hero, the Circle, its steps and every section', async ({ page }) => {
    // A hydration mismatch makes React re-render the page and drop the stored theme.
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page).toHaveTitle('Quad – School management built around the child');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every child has a circle.');
    await expect(page.getByRole('img', { name: /A watercolour picture: Amaya/ })).toBeVisible();
    await expect(page.getByRole('status').first()).toContainText('Ms. Jayasinghe shared a moment');

    const circle = page.locator('#circle');
    await expect(circle.getByRole('heading', { level: 2 })).toHaveText('What is the Quad Circle?');
    const steps = circle.getByRole('list', { name: 'How the circle works' }).getByRole('listitem');
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(0)).toContainText('A moment at school');
    await expect(steps.nth(3)).toContainText('The teacher sees it');
    // The diagram's text equivalent lists everyone in Amaya's circle.
    await expect(
      circle.getByRole('listitem').filter({ hasText: 'Kamala, her grandmother' }),
    ).toHaveCount(1);
    await expect(circle.getByRole('listitem').filter({ hasText: 'Sunethra aunty' })).toHaveCount(1);

    for (const heading of [
      'One school day in Amaya’s circle',
      'Four ideas that put people first',
      'Is every family connected?',
      'Everything a school runs, under one roof',
      'Children’s data, handled with care',
      'Book a 30‑minute walkthrough',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
    }
    await expect(page.locator('#day').getByRole('listitem')).toHaveCount(7);
    await expect(
      page.getByRole('table', { name: /Share of families who heard something positive/ }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /hello@quad-edu\.com/ })).toHaveAttribute(
      'href',
      'mailto:hello@quad-edu.com',
    );
    expect(errors).toEqual([]);
  });

  test('Sign in shows the coming-soon note before launch, and Escape closes it', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    const banner = page.getByRole('banner');
    if (!isPrelaunch(testInfo)) {
      await expect(banner.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/app');
      return;
    }
    const signIn = banner.getByRole('button', { name: 'Sign in' });
    await signIn.click();
    const note = page.getByRole('dialog', { name: 'Sign-in opens when schools go live' });
    await expect(note).toBeVisible();
    await expect(note.getByRole('link', { name: 'Book a demo' })).toHaveAttribute('href', '#demo');
    await expect(page.locator('a[href="/sign-in"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(note).toBeHidden();
    await expect(signIn).toBeFocused();

    // The hero's "Sign in to your school" opens the same note; booking a demo leads to the form.
    await page.getByRole('button', { name: 'Sign in to your school' }).click();
    const again = page.getByRole('dialog', { name: 'Sign-in opens when schools go live' });
    await again.getByRole('link', { name: 'Book a demo' }).click();
    await expect(again).toBeHidden();
    await expect(page.getByLabel('Your name')).toBeFocused();
  });

  test('the demo form checks the fields, then opens an email with the request', async ({
    page,
  }) => {
    // Catch the mailto: link instead of opening an email app.
    await page.addInitScript(() => {
      const opened: string[] = [];
      Object.assign(window, { openedEmails: opened });
      HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
        opened.push(this.href);
      };
    });
    await page.goto('/#demo');
    const form = page.locator('#demo form');
    const submit = form.getByRole('button', { name: 'Request a demo' });
    await submit.click();
    await expect(form.getByRole('alert')).toHaveText('Add your name and your school.');
    await expect(form.getByLabel('Your name')).toHaveAttribute('aria-invalid', 'true');

    await form.getByLabel('Your name').fill('Sample Person');
    await form.getByLabel('School').fill('Sample School');
    await form.getByLabel('Work email').fill('not-an-email');
    await submit.click();
    await expect(form.getByRole('alert')).toHaveText('Enter a work email like name@school.lk.');

    await form.getByLabel('Work email').fill('name@school.lk');
    await form.getByLabel('Students').selectOption('1000_2500');
    await submit.click();
    await expect(form.getByRole('status')).toContainText(
      'Your email app should open with your request ready to send.',
    );
    const opened = await page.evaluate(
      () => (window as unknown as { openedEmails: string[] }).openedEmails,
    );
    expect(opened).toHaveLength(1);
    const href = opened[0] ?? '';
    const mail = new URL(href);
    expect(mail.protocol).toBe('mailto:');
    expect(mail.pathname).toBe('hello@quad-edu.com');
    expect(mail.searchParams.get('subject')).toBe('Demo request: Sample School');
    expect(mail.searchParams.get('body')).toContain('Your name: Sample Person');
    expect(mail.searchParams.get('body')).toContain('Students: 1,000–2,500');
    expect(mail.searchParams.get('body')).toContain('Curriculum: Cambridge');
    await expect(form.getByRole('link', { name: 'hello@quad-edu.com' })).toHaveAttribute(
      'href',
      href,
    );
    await expect(page).toHaveURL(/\/#demo$/);
  });

  test('fits the screen, follows the theme and passes axe', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSideScroll(page);
    await expect(page.locator('[data-site="public"]')).toHaveCSS(
      'background-color',
      CANVAS[schemeOf(testInfo)],
    );
    await expectNoSeriousA11yViolations(page);
  });

  test('the phone menu opens by keyboard and Escape returns to it', async ({ page }) => {
    test.skip(!isPhone(page), 'The section links move into Menu at 900 px and below');
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu' });
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('link', { name: 'Why Quad' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Book a demo' })).toBeVisible();
  });

  test('the theme button switches light and dark and remembers it', async ({ page }, testInfo) => {
    await page.goto('/');
    const scheme = schemeOf(testInfo);
    const next = scheme === 'dark' ? 'light' : 'dark';
    if (isPhone(page)) await page.getByRole('button', { name: 'Menu' }).click();
    const scope = isPhone(page) ? page.locator('header') : page.getByRole('banner');
    const toggle = scope.getByRole('button', { name: /Switch to (dark|light) mode/ }).last();
    // After hydration the label follows the device's scheme.
    await expect(toggle).toHaveAttribute('aria-label', `Switch to ${next} mode`);
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', next);
    await expect(page.locator('[data-site="public"]')).toHaveCSS('background-color', CANVAS[next]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', next);
    await expect(page.locator('[data-site="public"]')).toHaveCSS('background-color', CANVAS[next]);
  });

  test('with reduced motion the ticker stays on the first event', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const ticker = page.locator('[role="status"][aria-live="polite"]').first();
    await expect(ticker).toContainText('Ms. Jayasinghe shared a moment');
    await page.waitForTimeout(3600);
    await expect(ticker).toContainText('Ms. Jayasinghe shared a moment');
  });

  test('without reduced motion the ticker moves on every 3.2 seconds', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const ticker = page.locator('[role="status"][aria-live="polite"]').first();
    await expect(ticker).toContainText('Dilhani said thank you', { timeout: 6000 });
  });
});
