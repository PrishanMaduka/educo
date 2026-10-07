import { expect, test } from '@playwright/test';
import {
  expectCanvas,
  expectNoSeriousA11yViolations,
  expectNoSideScroll,
  schemeOf,
} from '@quad/config/playwright/checks';

const GREETING = /^(Good morning|Good afternoon|Good evening|Hello), Prishan$/;

test.describe('staff shell', () => {
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

  test('/ is the landing placeholder with a link to the portal', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Quad: the landing page arrives in M1b')).toBeVisible();
    await page.getByRole('link', { name: 'Open the staff portal' }).click();
    await expect(page).toHaveURL(/\/app$/);
  });
});
