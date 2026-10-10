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
  {
    path: '/legal/dpa',
    title: 'Data processing agreement – Quad',
    h1: 'Data processing agreement',
  },
  { path: '/legal/cookies', title: 'Cookie notice – Quad', h1: 'Cookie notice' },
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
    for (const path of ['/legal/privacy', '/legal/terms', '/legal/dpa', '/legal/cookies']) {
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

  test('About shows the three apps, the timeline and the founder (D45)', async ({ page }) => {
    await page.goto('/about');
    for (const name of ['The staff portal', 'The Quad app for parents', 'The platform console']) {
      await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible();
    }
    const stage = page.getByRole('region', { name: 'Where we are now' });
    for (const step of ['Founded in 2026', 'In development', 'Pilots with schools']) {
      await expect(stage.getByText(step, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Prishan Maduka', level: 3 })).toBeVisible();
    await expect(page.getByRole('link', { name: /Book a 30-minute demo/ }).last()).toHaveAttribute(
      'href',
      '/#demo',
    );
  });

  test('Security & trust shows each promise and opens its detail (D45)', async ({ page }) => {
    await page.goto('/security');
    await expect(
      page.getByText('A query can only ever see one school’s rows.', { exact: true }),
    ).toBeVisible();
    const detail = page.getByText(
      'The app connects to the database with its own role, which cannot bypass those rules.',
    );
    await expect(detail).toBeHidden();
    const toggle = page.getByText('The detail: Each school’s data is kept apart');
    await toggle.click();
    await expect(detail).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await toggle.click();
    await expect(detail).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Report a security issue' })).toBeVisible();
  });

  test('legal pages open with "In short" and keep "On this page" in reach (D45)', async ({
    page,
  }) => {
    await page.goto('/legal/terms');
    const inShort = page.getByRole('region', { name: 'In short' });
    await expect(inShort.getByRole('listitem')).toHaveCount(6);
    await expect(
      inShort.getByText('Everything the school puts into Quad belongs to the school.', {
        exact: false,
      }),
    ).toBeVisible();
    const contents = page.getByRole('navigation', { name: 'On this page' });
    await expect(contents.getByRole('link')).toHaveCount(12);
    await page.getByRole('heading', { name: 'Governing law', level: 2 }).scrollIntoViewIfNeeded();
    if ((page.viewportSize()?.width ?? 0) > 1100) {
      // From 1100 px the list stays beside the cards as the page scrolls.
      await expect(contents).toBeInViewport();
    } else {
      // Narrower, it is a row of chips above the cards.
      await expect(contents).not.toBeInViewport();
    }
  });

  test('the privacy policy names every sub-processor (D44)', async ({ page }) => {
    await page.goto('/legal/privacy#subprocessors');
    const list = page.getByRole('list', { name: 'Sub-processors' });
    for (const name of [
      'Amazon Web Services',
      'Anthropic',
      'Google Firebase (FCM)',
      'Sentry',
      'Notify.lk',
      'Twilio',
      'Cloudflare (Turnstile)',
      'Grafana Labs',
      'PayHere, Stripe',
    ]) {
      await expect(list.getByRole('heading', { name, exact: true, level: 3 })).toBeVisible();
    }
    // Google Analytics handles data for this website, where Quad decides, not for schools (D57).
    const site = page.getByRole('list', { name: 'Companies that handle data for this website' });
    await expect(
      site.getByRole('heading', { name: 'Google Analytics', exact: true, level: 3 }),
    ).toBeVisible();
    await expect(site.getByText(/Google Ireland Limited/)).toBeVisible();
    await expect(
      page.getByText('Email support@quad-edu.com to be told about changes'),
    ).toBeVisible();
  });

  test('the DPA says it is a draft that needs legal review before launch (D57)', async ({
    page,
  }) => {
    await page.goto('/legal/dpa');
    await expect(
      page.getByText('Draft, version 0.1: this needs legal review before launch'),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'In short' }).getByRole('listitem')).toHaveCount(
      6,
    );
  });

  test('the cookie notice lists the necessary cookies, then analytics only if you accept', async ({
    page,
  }) => {
    await page.goto('/legal/cookies');
    const necessary = page.getByRole('region', { name: /Strictly necessary/ });
    await expect(
      necessary.getByRole('heading', { name: '__Host-quad_sid', exact: true, level: 3 }),
    ).toBeVisible();
    const analytics = page.getByRole('region', { name: /only if you accept/ });
    for (const name of ['_ga', '_ga_<id>']) {
      await expect(analytics.getByRole('heading', { name, exact: true, level: 3 })).toBeVisible();
    }
    await expect(necessary.getByRole('heading', { name: '_ga', exact: true })).toHaveCount(0);
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
      ['Data processing agreement', '/legal/dpa'],
      ['Cookies', '/legal/cookies'],
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
