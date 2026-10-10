import { readFileSync } from 'node:fs';

import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import {
  expectNoSeriousA11yViolations,
  expectNoSideScroll,
  schemeOf,
} from '@quad/config/playwright/checks';

import { PRISHAN_STATE } from './sign-in-as';

/*
 * The public landing page (spec 19). Runs against the staff app's server build and, through
 * playwright.export.config.ts, against the pre-launch static export (project metadata `prelaunch`).
 */
const isPrelaunch = (testInfo: TestInfo) => testInfo.project.metadata.prelaunch === true;
const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 0) <= 1100;

/** The hero (navy) and page (cream) grounds, light and dark (spec 19 palette). */
const GROUND = {
  hero: { light: 'rgb(16, 22, 50)', dark: 'rgb(10, 13, 36)' },
  page: { light: 'rgb(247, 245, 240)', dark: 'rgb(15, 19, 48)' },
} as const;

/** Catches the mailto: links the forms open, instead of opening an email app. */
async function catchEmails(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const opened: string[] = [];
    Object.assign(window, { openedEmails: opened });
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      opened.push(this.href);
    };
  });
}

const openedEmails = (page: Page) =>
  page.evaluate(() => (window as unknown as { openedEmails: string[] }).openedEmails);

/**
 * Runs axe on a still page: after hydration (the view switch reports the view that `data-view`
 * shows) and once no colour transition is running, so axe never samples a colour mid-change.
 */
async function expectAccessibleOnceStill(page: Page): Promise<void> {
  const view = await page.evaluate(() => document.documentElement.dataset.view ?? 'school');
  const label = view === 'parent' ? 'I’m a parent' : 'I run a school';
  await expect(
    page.getByRole('group', { name: 'Choose your view' }).getByRole('button', { name: label }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) => !(animation instanceof CSSTransition) || animation.playState !== 'running',
      ),
  );
  await expectNoSeriousA11yViolations(page);
}

test.describe('landing page', () => {
  test('tells the story: hero, the circle, wellbeing, modules and the demo', async ({ page }) => {
    // A hydration mismatch makes React re-render the page and drop the stored theme and view.
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page).toHaveTitle('Quad – School management built around the child');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'Every child has a circle.',
    );
    await expect(
      page.getByRole('img', { name: /A sample school day. Maya’s circle/ }),
    ).toBeVisible();

    const steps = page.locator('#circle').getByRole('listitem');
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(0)).toContainText('A moment at school');
    await expect(steps.nth(3)).toContainText('The teacher sees it');

    for (const heading of [
      'One week, round the circle.',
      'Quad notices the child who’s drifting.',
      'Everything a school runs, under one roof.',
      'Kind and safe by design',
      'See your school’s circle in 30 minutes.',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    await expect(
      page.locator('#more').getByRole('listitem').filter({ hasText: 'Admissions' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'support@quad-edu.com' })).toHaveAttribute(
      'href',
      'mailto:support@quad-edu.com',
    );
    expect(errors).toEqual([]);
  });

  test('“I’m a parent” switches the page, and ?view=parent remembers it', async ({ page }) => {
    await page.goto('/');
    const views = page.getByRole('group', { name: 'Choose your view' });
    const parent = views.getByRole('button', { name: 'I’m a parent' });
    await expect(views.getByRole('button', { name: 'I run a school' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await parent.click();
    await expect(parent).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'Hear the good stuff first, in the app.',
    );
    await expect(page).toHaveURL(/\?view=parent$/);
    await expect(
      page.getByRole('heading', { name: 'Watch a week of good news grow.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Quad notices the child who’s drifting.' }),
    ).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'Want this at your child’s school?' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in to your school' })).toBeHidden();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'Hear the good stuff first, in the app.',
    );
    await page.goto('/?view=school');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'Every child has a circle.',
    );
  });

  test('Sign in opens the sign-in dialog, and Escape closes it back to Sign in (D57)', async ({
    page,
  }, testInfo) => {
    test.skip(isPrelaunch(testInfo), 'Before launch Sign in opens the coming-soon note');
    await page.goto('/');
    if (isNarrow(page)) await page.getByRole('button', { name: 'Menu' }).click();
    const signIn = page
      .locator('header')
      .getByRole('button', { name: 'Sign in' })
      .filter({ visible: true });
    await expect(signIn).toHaveAttribute('aria-haspopup', 'dialog');
    await signIn.click();
    const dialog = page.getByRole('dialog', { name: 'Sign in to Quad' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Work email')).toBeFocused();
    await expect(dialog.getByText('Parents: use the Quad app.')).toBeVisible();
    await expect(dialog.getByRole('img', { name: 'App Store, coming soon' })).toBeVisible();
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);
    // Tab stays inside the modal dialog.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(signIn).toBeFocused();

    // The hero's "Sign in to your school" opens it too; a click on the backdrop closes it.
    if (isNarrow(page)) await page.keyboard.press('Escape');
    const hero = page.getByRole('button', { name: 'Sign in to your school' });
    await hero.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(dialog).toBeHidden();
    await expect(hero).toBeFocused();
  });

  test('/#signin opens the sign-in dialog, and closing it takes #signin off the address', async ({
    page,
  }, testInfo) => {
    test.skip(isPrelaunch(testInfo), 'Before launch there is no sign-in dialog');
    await page.goto('/#signin');
    const dialog = page.getByRole('dialog', { name: 'Sign in to Quad' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close sign-in' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL('/');
  });

  test('a signed-in visitor sees Open {school} in place of every Sign in, and it opens /app', async ({
    page,
  }, testInfo) => {
    test.skip(isPrelaunch(testInfo), 'Before launch there is no sign-in');
    // Prishan's session from the global sign-in, read only (D57: GET /me decides).
    const state: unknown = JSON.parse(readFileSync(PRISHAN_STATE, 'utf8'));
    const { cookies } = state as { cookies: Parameters<BrowserContext['addCookies']>[0] };
    await page.context().addCookies(cookies);
    await page.goto('/');
    const open = page.getByRole('link', { name: 'Open Colombo International School' });
    // All four entries switch: the top bar's (in the closed menu at 1100 px and below, so not
    // exposed), the menu's, the hero's and the footer's.
    await expect(page.locator('a[data-open-school]')).toHaveCount(4);
    await expect(open).toHaveCount(isNarrow(page) ? 2 : 3);
    await expect(page.locator('[data-signin]')).toHaveCount(0);
    for (const link of await open.all()) await expect(link).toHaveAttribute('href', '/app');
    // A school's full name fits beside the top bar's links, and the links pass axe.
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);
    await open.last().click();
    await expect(page).toHaveURL('/app');
  });

  test('the pre-launch export never asks the API who is signed in', async ({ page }, testInfo) => {
    test.skip(!isPrelaunch(testInfo), 'Only the static export leaves the API out');
    // A CSRF cookie, as a visitor signed in to the live portal would carry.
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) throw new Error('The export config has no baseURL.');
    await page.context().addCookies([{ name: 'quad_csrf', value: 'token', url: baseURL }]);
    const asked: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/')) asked.push(request.url());
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sign in' }).first()).toBeAttached();
    await page.waitForLoadState('networkidle');
    expect(asked).toEqual([]);
    await expect(page.getByRole('link', { name: /^Open / })).toHaveCount(0);
  });

  test('Sign in shows the coming-soon note before launch, and Escape closes it', async ({
    page,
  }, testInfo) => {
    test.skip(!isPrelaunch(testInfo), 'After launch Sign in opens the sign-in dialog');
    await page.goto('/');
    if (isNarrow(page)) await page.getByRole('button', { name: 'Menu' }).click();
    const header = page.locator('header');
    await expect(page.locator('[data-signin-dialog]')).toHaveCount(0);
    const signIn = header.getByRole('button', { name: 'Sign in' }).filter({ visible: true });
    await signIn.click();
    const note = page.getByRole('dialog', { name: 'Sign-in opens when schools go live' });
    await expect(note).toBeVisible();
    await expect(note.getByRole('link', { name: 'Book a demo' })).toHaveAttribute('href', '#demo');
    await expect(page.locator('a[href^="/sign-in"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(note).toBeHidden();
    await expect(signIn).toBeFocused();

    // The hero's "Sign in to your school" opens the same note; booking a demo leads to the form.
    if (isNarrow(page)) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Sign in to your school' }).click();
    const again = page.getByRole('dialog', { name: 'Sign-in opens when schools go live' });
    await again.getByRole('link', { name: 'Book a demo' }).click();
    await expect(again).toBeHidden();
    await expect(page.getByLabel('Your name').filter({ visible: true })).toBeFocused();
  });

  test('the footer’s Sign in opens the coming-soon note before launch', async ({
    page,
  }, testInfo) => {
    const footer = page.getByRole('navigation', { name: 'About Quad' });
    for (const path of ['/', '/about']) {
      await page.goto(path);
      if (!isPrelaunch(testInfo)) {
        // After launch it opens the sign-in dialog, on the landing page and the other pages.
        const signIn = footer.getByRole('button', { name: 'Sign in' });
        await signIn.click();
        const dialog = page.getByRole('dialog', { name: 'Sign in to Quad' });
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(signIn).toBeFocused();
        continue;
      }
      await expect(footer.locator('a[href="/app"]')).toHaveCount(0);
      const signIn = footer.getByRole('button', { name: 'Sign in' });
      await signIn.click();
      const note = page.getByRole('dialog', { name: 'Sign-in opens when schools go live' });
      await expect(note).toBeVisible();
      await expect(note.getByRole('link', { name: 'Book a demo' })).toHaveAttribute(
        'href',
        path === '/' ? '#demo' : '/#demo',
      );
      await page.keyboard.press('Escape');
      await expect(note).toBeHidden();
      await expect(signIn).toBeFocused();
    }
  });

  test('the pre-launch site has no sign-in pages (D32)', async ({ page }, testInfo) => {
    test.skip(!isPrelaunch(testInfo), 'Only the static export leaves sign-in out');
    for (const path of ['/sign-in', '/sign-in/reset/a.b', '/app']) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(404);
    }
    await page.goto('/');
    await expect(page.locator('a[href^="/sign-in"]')).toHaveCount(0);
  });

  test('parents get the app instead of signing in: the note, the badges and their form', async ({
    page,
  }) => {
    await page.goto('/?view=parent');
    const header = page.locator('header');
    if (isNarrow(page)) await header.getByRole('button', { name: 'Menu' }).click();
    // Staff sign-in is for schools only; parents see Get the app in its place.
    await expect(
      header.getByRole('button', { name: 'Sign in' }).filter({ visible: true }),
    ).toHaveCount(0);
    await expect(
      header.getByRole('link', { name: 'Sign in' }).filter({ visible: true }),
    ).toHaveCount(0);
    await expect(
      header.getByRole('link', { name: 'Get the app' }).filter({ visible: true }),
    ).toHaveAttribute('href', '#getapp');
    if (isNarrow(page)) await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Sign in to your school' })).toBeHidden();
    await expect(page.getByText('Already have the app? Open it on your phone.')).toBeVisible();

    // The app isn't in the stores yet: the button says so instead of linking to a store.
    const getApp = page.getByRole('button', { name: 'Get the Quad app' });
    await expect(getApp).toHaveAttribute('aria-expanded', 'false');
    await getApp.click();
    await expect(getApp).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#getapp + div').getByRole('status')).toHaveText(
      /^Coming soon\. The Quad app isn’t in the App Store or Google Play yet\./,
    );
    for (const store of ['App Store, coming soon', 'Google Play, coming soon']) {
      await expect(page.getByRole('img', { name: store }).filter({ visible: true })).toHaveCount(2);
    }
    await expect(page.locator('a[href*="apps.apple.com"], a[href*="play.google.com"]')).toHaveCount(
      0,
    );

    // "Ask your school about Quad" leads to the parent form.
    await page.getByRole('link', { name: 'Ask your school about Quad' }).click();
    await expect(page).toHaveURL(/#demo$/);
    await expect(
      page.getByRole('heading', { name: 'Want this at your child’s school?' }),
    ).toBeInViewport();
    await expect(page.getByRole('button', { name: /Send to my school/ })).toBeVisible();
    await expect(
      page.getByRole('img', { name: /The Quad parent app on two phones/ }),
    ).toBeAttached();
  });

  test('a school’s demo request checks the fields, then opens an email to support', async ({
    page,
  }) => {
    await catchEmails(page);
    await page.goto('/#demo');
    const form = page.locator('#demo form').filter({ visible: true });
    const submit = form.getByRole('button', { name: /Request a demo/ });
    await submit.click();
    await expect(form.getByRole('alert')).toHaveText('Add your name and your school.');
    await expect(form.getByLabel('Your name')).toHaveAttribute('aria-invalid', 'true');

    await form.getByLabel('Your name').fill('Sample Person');
    await form.getByLabel('School').fill('Sample School');
    await form.getByLabel('Work email').fill('not-an-email');
    await submit.click();
    await expect(form.getByRole('alert')).toHaveText('Enter a work email like name@school.org.');

    await form.getByLabel('Work email').fill('name@school.org');
    await form.getByLabel('Country').fill('Portugal');
    await form.getByLabel('Students').selectOption('1000_2500');
    await submit.click();
    const done = page.locator('#demo').getByRole('status').filter({ visible: true });
    await expect(done).toContainText('Your email app should open with your request ready to send.');
    const opened = await openedEmails(page);
    expect(opened).toHaveLength(1);
    const mail = new URL(opened[0] ?? '');
    expect(mail.pathname).toBe('support@quad-edu.com');
    expect(mail.searchParams.get('subject')).toBe('Demo request: Sample School');
    expect(mail.searchParams.get('body')).toContain('Work email: name@school.org');
    expect(mail.searchParams.get('body')).toContain('Country: Portugal');
    expect(mail.searchParams.get('body')).toContain('Students: 1,000–2,500');
    expect(mail.searchParams.get('body')).toContain('Curriculum: IB');
    await expect(done.getByRole('link', { name: 'support@quad-edu.com' })).toHaveAttribute(
      'href',
      opened[0] ?? '',
    );
    await expect(page).toHaveURL(/\/#demo$/);
  });

  test('a parent’s request goes to support with the school and the note', async ({ page }) => {
    await catchEmails(page);
    await page.goto('/?view=parent#demo');
    const form = page.locator('#demo form').filter({ visible: true });
    await form.getByRole('button', { name: /Send to my school/ }).click();
    await expect(form.getByRole('alert')).toHaveText('Add your name and your child’s school.');
    await form.getByLabel('Your name').fill('Sample Parent');
    await form.getByLabel('Your email').fill('name@example.com');
    await form.getByLabel('Your child’s school').fill('Sample School');
    await form.getByLabel('City').fill('Lisbon');
    await form.getByLabel(/A note to the school/).fill('We would love it.');
    await form.getByRole('button', { name: /Send to my school/ }).click();
    const mail = new URL((await openedEmails(page))[0] ?? '');
    expect(mail.pathname).toBe('support@quad-edu.com');
    expect(mail.searchParams.get('subject')).toBe('Quad for Sample School');
    expect(mail.searchParams.get('body')).toContain('City: Lisbon');
    expect(mail.searchParams.get('body')).toContain('Note: We would love it.');
  });

  test('Leo’s card starts a support plan and replays', async ({ page }) => {
    await page.goto('/#wellbeing');
    const card = page.locator('#wellbeing');
    const plan = card.getByRole('button', { name: 'Start a support plan' });
    await expect(card.getByText('Needs a conversation')).toBeVisible();
    await plan.click();
    const replay = card.getByRole('button', { name: 'Replay' });
    await expect(replay).toHaveAttribute('aria-pressed', 'true');
    await expect(card.getByText('Back on track')).toBeVisible();
    await expect(card.getByText(/Six weeks later: Leo’s History is back up/)).toBeVisible();
    await replay.click();
    await expect(plan).toHaveAttribute('aria-pressed', 'false');
    await expect(card.getByText(/down 14 points this term/)).toBeVisible();
  });

  test('fits the screen, follows the theme and passes axe in both views', async ({
    page,
  }, testInfo) => {
    const scheme = schemeOf(testInfo);
    // axe checks a still page: a lit avatar's name changes colour over 300 ms as moments arrive.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSideScroll(page);
    await expect(page.locator('[data-site="public"]')).toHaveCSS(
      'background-color',
      GROUND.hero[scheme],
    );
    await expect(page.locator('#circle')).toHaveCSS('background-color', GROUND.page[scheme]);
    await expectAccessibleOnceStill(page);
    await page.goto('/?view=parent');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'Hear the good stuff first, in the app.',
    );
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);
  });

  test('the view switch shows the chosen view from the first paint, without a colour swap', async ({
    page,
  }) => {
    // Every frame from the first paint, note the "I run a school" button's background.
    await page.addInitScript(() => {
      const seen: string[] = [];
      Object.assign(window, { schoolButtonBackgrounds: seen });
      const sample = () => {
        const button = document.querySelector('[aria-label="Choose your view"] button');
        if (button) {
          const background = getComputedStyle(button).backgroundColor;
          if (seen.at(-1) !== background) seen.push(background);
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto('/?view=parent');
    const group = page.getByRole('group', { name: 'Choose your view' });
    await expect(group.getByRole('button', { name: 'I’m a parent' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(group.getByRole('button', { name: 'I run a school' })).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    const backgrounds = await page.evaluate(
      () => (window as unknown as { schoolButtonBackgrounds: string[] }).schoolButtonBackgrounds,
    );
    expect(backgrounds).toEqual(['rgba(0, 0, 0, 0)']);
  });

  test('the menu opens by keyboard and Escape returns to it', async ({ page }) => {
    test.skip(!isNarrow(page), 'The section links move into Menu at 1100 px and below');
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu' });
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.locator('header').getByRole('link', { name: 'Wellbeing' }).filter({ visible: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
    await expect(page.locator('header').getByRole('link', { name: 'Book a demo' })).toBeVisible();
  });

  test('the theme button switches light and dark and remembers it', async ({ page }, testInfo) => {
    await page.goto('/');
    const scheme = schemeOf(testInfo);
    const next = scheme === 'dark' ? 'light' : 'dark';
    if ((page.viewportSize()?.width ?? 0) <= 760)
      await page.getByRole('button', { name: 'Menu' }).click();
    const toggle = page
      .locator('header')
      .getByRole('button', { name: /Switch to (dark|light) mode/ })
      .filter({ visible: true });
    // After hydration the label follows the device's scheme.
    await expect(toggle).toHaveAttribute('aria-label', `Switch to ${next} mode`);
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', next);
    await expect(page.locator('#circle')).toHaveCSS('background-color', GROUND.page[next]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', next);
  });

  test('with reduced motion the phone stays on its first messages', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const live = page.locator('#main [role="status"][aria-live="polite"]').first();
    await expect(live).toHaveText(
      'Priya said thank you: Thank you! She talked about it all breakfast.',
    );
    await page.waitForTimeout(4000);
    await expect(live).toHaveText(/^Priya said thank you/);
  });

  test('without reduced motion each new moment is announced politely', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const live = page.locator('#main [role="status"][aria-live="polite"]').first();
    await expect(live).toHaveText(/^Nani Asha loved it: Invited relative/, { timeout: 6000 });
  });
});
