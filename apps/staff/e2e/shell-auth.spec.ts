import { expect } from '@playwright/test';
import {
  expectCanvas,
  expectAccessibleOnceStill,
  expectNoSideScroll,
  schemeOf,
} from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';
import { deriveBrand } from '@quad/tokens';

import { PASSWORD_JOURNEY_PROJECTS, PEOPLE, PRISHAN_STATE, signInThroughApi } from './sign-in-as';
import { GREETING, brandVariable, isPhone, openNav, openProfileMenu, title } from './steps';

/*
 * The signed-in portal shell against the e2e stack (spec 05, spec 08): the school's name, brand
 * and the role's menu from GET /me and /me/permissions, the profile menu (Switch school, Sign
 * out) and the no-access and View only pages. Switch school is journey 18 and Preview a role
 * journey 50 (`journeys/`, Task 26). Journeys that only read share
 * Prishan's session from `global-sign-in.ts`; the ones that change a session sign in on their
 * own, as other people where they can, on `PASSWORD_JOURNEY_PROJECTS` (the API's per-email limit
 * on password calls, 10 per address in 15 minutes, is counted there). `@webkit` journeys also run
 * in the CI-only WebKit project (D27): the session cookie and focus return.
 */

test.describe('signed out', () => {
  test(
    'a visit to the portal goes to sign-in, keeping the page as ?next=',
    { tag: '@webkit' },
    async ({ page }) => {
      const response = await page.request.get('/app', { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toBe('/sign-in?next=%2Fapp');
    },
  );

  test(
    'a session the API no longer accepts goes to sign-in, back to the same page',
    { tag: '@webkit' },
    async ({ page, context, baseURL }) => {
      await context.addCookies([
        { name: 'quad_sid', value: 'expired-session', url: baseURL ?? '' },
      ]);
      await page.goto('/app/fees?term=2');
      await expect(page).toHaveURL('/sign-in?next=%2Fapp%2Ffees%3Fterm%3D2');
      await expect(title(page, 'Sign in to Quad')).toBeVisible();
    },
  );
});

test.describe('the shell, signed in as the school admin', () => {
  test.use({ storageState: PRISHAN_STATE });

  test('/app greets Prishan and shows the school and its whole menu', async ({ page }) => {
    await page.goto('/app');
    await expect(title(page, GREETING)).toBeVisible();
    const nav = await openNav(page);
    await expect(nav.getByText('Colombo International School')).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: 'Users & roles' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Pickup' })).toBeVisible();
    await expect(nav.getByText('School admin')).toBeVisible();
  });

  test('uses the school’s brand colour for the active item', async ({ page }, testInfo) => {
    await page.goto('/app');
    await expect(title(page, GREETING)).toBeVisible();
    const scheme = schemeOf(testInfo);
    const derived = deriveBrand('#DD4A42', scheme);
    expect((await brandVariable(page, '--quad-brand-fill')).toLowerCase()).toBe(
      derived.fill.toLowerCase(),
    );
    expect((await brandVariable(page, '--quad-rail-active')).toLowerCase()).toBe(
      derived.railActive.toLowerCase(),
    );
  });

  test('/app fits the screen, uses the canvas colour and passes axe', async ({
    page,
  }, testInfo) => {
    await page.goto('/app');
    await expect(title(page, GREETING)).toBeVisible();
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectAccessibleOnceStill(page);
  });

  test('a page still being built says it arrives soon, and passes axe', async ({ page }) => {
    await page.goto('/app/fees');
    await expect(title(page, 'Fees & invoicing')).toBeVisible();
    await expect(page.getByText('Fees & invoicing arrives soon')).toBeVisible();
    await expect(page).toHaveTitle(/Fees & invoicing/);
    await expectNoSideScroll(page);
    await expectAccessibleOnceStill(page);
  });

  test('an unknown path shows the 404 page with a way home', async ({ page }, testInfo) => {
    const response = await page.goto('/app/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(title(page, "We couldn't find that page")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/app');
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectAccessibleOnceStill(page);
  });

  test(
    'the profile menu names the school and offers Sign out, and passes axe',
    { tag: '@webkit' },
    async ({ page }) => {
      await page.goto('/app');
      await expect(title(page, GREETING)).toBeVisible();
      const menu = await openProfileMenu(page);
      await expect(menu.getByText('Colombo International School')).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Sign out' })).toBeVisible();
      // Prishan is in one school, so there is nothing to switch to.
      await expect(menu.getByText('Switch school')).toHaveCount(0);
      await expectAccessibleOnceStill(page);
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(page.getByRole('button', { name: 'Open your profile menu' })).toBeFocused();
    },
  );

  test('View as is in the top bar on desktop only', async ({ page }) => {
    await page.goto('/app');
    await expect(title(page, GREETING)).toBeVisible();
    const picker = page.getByRole('combobox', { name: 'View as role' });
    if (isPhone(page)) await expect(picker).toBeHidden();
    else await expect(picker).toHaveText(/View as: you/);
  });

  test('the theme button cycles system, light and dark and remembers the choice', async ({
    page,
  }) => {
    await page.goto('/app');
    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: 'Change theme' });
    await expect(toggle).toHaveAccessibleDescription('Theme: System');
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expectCanvas(page, 'light');
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expectCanvas(page, 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAccessibleDescription('Theme: Dark');
    await toggle.click();
    await expect(html).not.toHaveAttribute('data-theme', /.*/);
  });

  test('Ctrl K opens the search palette with the role’s pages', async ({ page }) => {
    await page.goto('/app');
    await expect(title(page, GREETING)).toBeVisible();
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Search' });
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('option', { name: /Users & roles/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Search students, staff and pages/ }).click();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  });

  test('the side bar collapses to icons and stays collapsed', async ({ page }) => {
    test.skip(isPhone(page), 'Phones use the slide-over menu');
    await page.goto('/app');
    const rail = page.getByRole('complementary', { name: 'Side bar' });
    await expect(rail).toHaveJSProperty('offsetWidth', 248);
    await page.getByRole('button', { name: 'Collapse side bar' }).click();
    await expect(rail).toHaveJSProperty('offsetWidth', 72);
    await page.reload();
    await expect(rail).toHaveJSProperty('offsetWidth', 72);
    await page.getByRole('button', { name: 'Expand side bar' }).click();
    await expect(rail).toHaveJSProperty('offsetWidth', 248);
  });

  test('a collapsed side bar is already 72 px before the page hydrates', async ({ page }) => {
    test.skip(isPhone(page), 'Phones use the slide-over menu');
    await page.addInitScript(() => {
      window.localStorage.setItem('quad-rail', 'collapsed');
      // Measured when the HTML is parsed, before React has re-rendered anything.
      document.addEventListener('DOMContentLoaded', () => {
        const rail = document.querySelector('aside');
        document.documentElement.dataset.railAtLoad = String(rail?.getBoundingClientRect().width);
      });
    });
    await page.goto('/app');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-rail', 'collapsed');
    await expect(html).toHaveAttribute('data-rail-at-load', '72');
    await page.getByRole('button', { name: 'Expand side bar' }).click();
    await expect(html).not.toHaveAttribute('data-rail', /.*/);
    await expect(page.getByRole('complementary', { name: 'Side bar' })).toHaveJSProperty(
      'offsetWidth',
      248,
    );
  });

  test(
    'closing the menu or the search returns focus to where it was',
    { tag: '@webkit' },
    async ({ page }) => {
      await page.goto('/app');
      await expect(title(page, GREETING)).toBeVisible();
      if (isPhone(page)) {
        const menuButton = page.getByRole('button', { name: 'Open menu' });
        await menuButton.click();
        await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menuButton).toBeFocused();
      }
      const search = page.getByRole('button', { name: /Search students, staff and pages/ });
      await search.click();
      await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(search).toBeFocused();

      const theme = page.getByRole('button', { name: 'Change theme' });
      await theme.focus();
      await page.keyboard.press('Control+k');
      await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(theme).toBeFocused();
    },
  );

  test('the phone menu closes when the screen grows past 900 px', async ({ page }) => {
    test.skip(!isPhone(page), 'The menu exists only on narrow screens');
    await page.goto('/app');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 844 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  });

  test('top bar buttons are at least 44 px on narrow screens', async ({ page }) => {
    test.skip(!isPhone(page), 'Touch targets apply below 900 px');
    await page.goto('/app');
    await expect(title(page, GREETING)).toBeVisible();
    // A phone, and a small tablet that still gets the phone shell.
    for (const width of [390, 800]) {
      await page.setViewportSize({ width, height: 844 });
      const buttons = page.getByRole('banner').getByRole('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(4);
      for (let i = 0; i < count; i += 1) {
        const box = await buttons.nth(i).boundingBox();
        expect(box?.width ?? 0, `button ${i} at ${width}px`).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0, `button ${i} at ${width}px`).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe('a teacher', () => {
  test('starts on My teaching, and a page outside the role says so with a way home', async ({
    page,
  }) => {
    await signInThroughApi(page.request, PEOPLE.nadeesha);
    await page.goto('/app');
    await expect(page).toHaveURL('/app/teaching');
    await expect(page.getByText('My teaching arrives soon')).toBeVisible();
    const nav = await openNav(page);
    await expect(nav.getByRole('link', { name: 'My teaching' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: 'Fees & invoicing' })).toHaveCount(0);
    if (isPhone(page)) await page.keyboard.press('Escape');

    await page.goto('/app/fees');
    await expect(title(page, 'Fees & invoicing isn’t part of the Teacher role')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to My teaching' })).toHaveAttribute(
      'href',
      '/app/teaching',
    );
    await expectAccessibleOnceStill(page);

    // A page the role can only read: the View only tag in place of actions.
    await page.goto('/app/timetable');
    await expect(title(page, 'Timetable')).toBeVisible();
    await expect(page.getByText('View only', { exact: true })).toBeVisible();
  });
});

test.describe('signing out', () => {
  test(
    'Sign out in the profile menu ends the session and goes to sign-in',
    { tag: '@webkit' },
    async ({ page }, testInfo) => {
      test.skip(
        !PASSWORD_JOURNEY_PROJECTS.includes(testInfo.project.name),
        'Dilini signs in with a password: see PASSWORD_JOURNEY_PROJECTS for the per-email limit',
      );
      await signInThroughApi(page.request, PEOPLE.dilini);
      await page.goto('/app');
      await expect(title(page, /, Dilini$/)).toBeVisible();
      const menu = await openProfileMenu(page);
      await menu.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL('/sign-in');
      await page.goto('/app');
      await expect(page).toHaveURL('/sign-in?next=%2Fapp');
    },
  );
});
