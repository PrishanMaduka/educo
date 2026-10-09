import { expect, test } from '@playwright/test';
import {
  expectCanvas,
  expectNoSeriousA11yViolations,
  expectNoSideScroll,
  schemeOf,
} from '@quad/config/playwright/checks';

import { withPortalCookie } from './portal-cookie';

const GREETING = /^(Good morning|Good afternoon|Good evening|Hello), Prishan$/;

test.describe('staff shell', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await withPortalCookie(context, baseURL ?? '');
  });

  test('/app shows the navigation and the greeting', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1, name: GREETING })).toBeVisible();
    const isPhone = (page.viewportSize()?.width ?? 0) < 900;
    if (isPhone) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      const menu = page.getByRole('dialog', { name: 'Menu' });
      await expect(menu.getByRole('navigation', { name: 'Main' })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Home' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    } else {
      const nav = page.getByRole('navigation', { name: 'Main' });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('/app fits the screen, uses the canvas colour and passes axe', async ({
    page,
  }, testInfo) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectNoSeriousA11yViolations(page);
  });

  test('an unknown path shows the 404 page with a way home', async ({ page }, testInfo) => {
    const response = await page.goto('/app/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: "We couldn't find that page" }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/app');
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectNoSeriousA11yViolations(page);
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

  test('Ctrl K opens the search palette', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Search students, staff and pages/ }).click();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  });

  test('the side bar collapses to icons and stays collapsed', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'Phones use the slide-over menu');
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
    test.skip((page.viewportSize()?.width ?? 0) < 900, 'Phones use the slide-over menu');
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

  test('closing the menu or the search returns focus to where it was', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const isPhone = (page.viewportSize()?.width ?? 0) < 900;
    if (isPhone) {
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
  });

  test('the phone menu closes when the screen grows past 900 px', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 900, 'The menu exists only on narrow screens');
    await page.goto('/app');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 844 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  });

  test('top bar buttons are at least 44 px on narrow screens', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 900, 'Touch targets apply below 900 px');
    await page.goto('/app');
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
