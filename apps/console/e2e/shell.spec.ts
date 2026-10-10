import { expect } from '@playwright/test';
import {
  expectCanvas,
  expectAccessibleOnceStill,
  expectNoSideScroll,
  schemeOf,
} from '@quad/config/playwright/checks';
import { test } from '@quad/config/playwright/stack';

import { OWNER_STATE, QUAD_STAFF } from './sign-in-as';

const isPhone = (width: number | undefined): boolean => (width ?? 0) < 900;

test.describe('console shell', () => {
  test.use({ storageState: OWNER_STATE });

  test('/ shows the navigation, the overview and the signed-in owner', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-app', 'console');
    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
    if (isPhone(page.viewportSize()?.width)) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      const menu = page.getByRole('dialog', { name: 'Menu' });
      await expect(menu.getByRole('navigation', { name: 'Main' })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    } else {
      const nav = page.getByRole('navigation', { name: 'Main' });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      const rail = page.getByRole('complementary', { name: 'Side bar' });
      await expect(rail).toContainText('Console');
      await expect(rail).toContainText(QUAD_STAFF.owner.name);
      await expect(rail).toContainText('Platform owner');
      await expect(nav.getByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/audit');
    }
  });

  test('/ fits the screen, uses the canvas colour and passes axe', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectAccessibleOnceStill(page);
  });

  test('the side bar is Quad navy and the active item is Quad lime (D34)', async ({
    page,
  }, testInfo) => {
    test.skip(isPhone(page.viewportSize()?.width), 'Phones use the slide-over menu');
    await page.goto('/');
    const rail = page.getByRole('complementary', { name: 'Side bar' });
    // The same navy as every school's portal: #101632 light, #0A0D24 dark (spec 03).
    const navy = { light: 'rgb(16, 22, 50)', dark: 'rgb(10, 13, 36)' }[schemeOf(testInfo)];
    await expect(rail).toHaveCSS('background-color', navy);
    // The console has no school, so the active pill is the default brand: lime with navy text.
    const active = rail.getByRole('link', { name: 'Overview' });
    await expect(active).toHaveCSS('background-color', 'rgb(200, 241, 105)');
    await expect(active).toHaveCSS('color', 'rgb(16, 22, 50)');
  });

  test('an unknown path shows the 404 page with a way home', async ({ page }, testInfo) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: "We couldn't find that page" }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/');
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectAccessibleOnceStill(page);
  });

  test('the theme button cycles system, light and dark', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: 'Change theme' });
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await expectCanvas(page, 'light');
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expectCanvas(page, 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });
});
