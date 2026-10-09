import { expect, test } from '@playwright/test';
import {
  expectNoSeriousA11yViolations,
  expectNoSideScroll,
  schemeOf,
} from '@quad/config/playwright/checks';

/*
 * The About, Security & trust and legal pages (spec 19, D41). Runs against the staff app's server
 * build and, through playwright.export.config.ts, against the pre-launch static export.
 */
const PAGES = [
  { path: '/about', title: 'About Quad', h1: 'A school platform built around the child.' },
  { path: '/security', title: 'Security & trust – Quad', h1: 'How Quad keeps school data safe.' },
  { path: '/legal/privacy', title: 'Privacy policy – Quad', h1: 'Privacy policy' },
  { path: '/legal/terms', title: 'Terms of service – Quad', h1: 'Terms of service' },
  { path: '/legal/subprocessors', title: 'Sub-processors – Quad', h1: 'Sub-processors' },
] as const;

/** The navy header and the cream page, light and dark (spec 19 palette). */
const GROUND = {
  hero: { light: 'rgb(16, 22, 50)', dark: 'rgb(10, 13, 36)' },
  page: { light: 'rgb(247, 245, 240)', dark: 'rgb(15, 19, 48)' },
} as const;

test.describe('public pages', () => {
  for (const page of PAGES) {
    test(`${page.path}: one heading, SEO tags, fits the screen and passes axe`, async ({
      page: browser,
    }, testInfo) => {
      const scheme = schemeOf(testInfo);
      const errors: string[] = [];
      browser.on('pageerror', (error) => errors.push(error.message));
      await browser.goto(page.path);
      await expect(browser).toHaveTitle(page.title);
      await expect(browser.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(browser.getByRole('heading', { level: 1 })).toHaveAccessibleName(page.h1);
      await expect(browser.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://quad-edu.com${page.path}`,
      );
      await expect(browser.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        /\S{10,}/,
      );
      await expect(browser.locator('main > header')).toHaveCSS(
        'background-color',
        GROUND.hero[scheme],
      );
      await expect(browser.locator('main > div')).toHaveCSS(
        'background-color',
        GROUND.page[scheme],
      );
      await expectNoSideScroll(browser);
      await browser.waitForFunction(() =>
        document
          .getAnimations()
          .every(
            (animation) =>
              !(animation instanceof CSSTransition) || animation.playState !== 'running',
          ),
      );
      await expectNoSeriousA11yViolations(browser);
      expect(errors).toEqual([]);
    });
  }

  test('the legal pages show when they last changed and their version', async ({ page }) => {
    for (const path of ['/legal/privacy', '/legal/terms', '/legal/subprocessors']) {
      await page.goto(path);
      await expect(page.getByText(/^Last updated \d{1,2} \w+ 20\d\d · Version \S+$/)).toBeVisible();
    }
  });

  test('section headings link to themselves', async ({ page }) => {
    await page.goto('/legal/privacy');
    const heading = page.getByRole('heading', { name: 'Ask Quad and Anthropic', level: 2 });
    await expect(heading.getByRole('link')).toHaveAttribute('href', '#ask-quad');
    await page
      .getByRole('navigation', { name: 'On this page' })
      .getByRole('link', { name: 'Cookies' })
      .click();
    await expect(page).toHaveURL(/#cookies$/);
    await expect(page.getByRole('heading', { name: 'Cookies', level: 2 })).toBeInViewport();
  });

  test('the sub-processor list names every sub-processor', async ({ page }) => {
    await page.goto('/legal/subprocessors');
    const wide = (page.viewportSize()?.width ?? 0) > 760;
    for (const name of [
      'Amazon Web Services',
      'Anthropic',
      'Google Firebase (FCM)',
      'Sentry',
      'Notify.lk',
      'Twilio',
      'Cloudflare (Turnstile)',
      'Grafana Labs',
      'Plausible Analytics',
      'PayHere, Stripe',
    ]) {
      const entry = wide
        ? page.getByRole('rowheader', { name, exact: true })
        : page.getByRole('heading', { name, exact: true, level: 3 });
      await expect(entry).toBeVisible();
    }
    await expect(
      page.getByText('Email privacy@quad-edu.com to be told about changes'),
    ).toBeVisible();
  });

  test('the footer links every page, and the top bar leads home and to the demo', async ({
    page,
  }) => {
    await page.goto('/about');
    const footer = page.getByRole('navigation', { name: 'About Quad' });
    for (const [name, path] of [
      ['Security & trust', '/security'],
      ['Privacy', '/legal/privacy'],
      ['Terms', '/legal/terms'],
      ['Sub-processors', '/legal/subprocessors'],
      ['About', '/about'],
    ] as const) {
      await footer.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'support@quad-edu.com' }).last()).toHaveAttribute(
      'href',
      'mailto:support@quad-edu.com',
    );
    await expect(page.getByText('Sample school and families are fictional.')).toBeVisible();
    await page.locator('header').getByRole('link', { name: 'Book a demo' }).click();
    await expect(page).toHaveURL(/\/#demo$/);
    await expect(
      page.getByRole('heading', { name: 'See your school’s circle in 30 minutes.' }),
    ).toBeVisible();
  });
});
