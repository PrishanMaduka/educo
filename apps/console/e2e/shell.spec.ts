import { expect, test } from '@playwright/test';
import {
  expectCanvas,
  expectNoSeriousA11yViolations,
  expectNoSideScroll,
  schemeOf,
} from '@quad/config/playwright/checks';

const isPhone = (width: number | undefined): boolean => (width ?? 0) < 900;

test.describe('console shell', () => {
  test('/ shows the navigation and the overview', async ({ page }) => {
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
      await expect(page.getByRole('complementary', { name: 'Side bar' })).toContainText('Console');
    }
  });

  test('/ fits the screen, uses the canvas colour and passes axe', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoSideScroll(page);
    await expectCanvas(page, schemeOf(testInfo));
    await expectNoSeriousA11yViolations(page);
  });

  test('the side bar uses the console rail and the lilac active item', async ({ page }) => {
    test.skip(isPhone(page.viewportSize()?.width), 'Phones use the slide-over menu');
    await page.goto('/');
    const rail = page.getByRole('complementary', { name: 'Side bar' });
    // Console rail #15173A light, #0C0D20 dark (spec 03); the active item is the lilac gold token.
    const railColour = await rail.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(['rgb(21, 23, 58)', 'rgb(12, 13, 32)']).toContain(railColour);
    const active = rail.getByRole('link', { name: 'Overview' });
    const lilac = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--quad-gold)';
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    });
    await expect(active).toHaveCSS('background-color', lilac);
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
    await expectNoSeriousA11yViolations(page);
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
