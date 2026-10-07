import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/** Spec 03 canvas colours: light #FAF8F5 and dark #13142A. */
export const CANVAS = { light: 'rgb(250, 248, 245)', dark: 'rgb(19, 20, 42)' } as const;

/** "light" or "dark", from the project's colour scheme. */
export function schemeOf(testInfo: TestInfo): 'light' | 'dark' {
  return testInfo.project.use.colorScheme === 'dark' ? 'dark' : 'light';
}

/** Spec 03 "Works on a phone": nothing scrolls sideways. */
export async function expectNoSideScroll(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

/** The body shows the theme's canvas colour. */
export async function expectCanvas(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  await expect(page.locator('body')).toHaveCSS('background-color', CANVAS[scheme]);
}

/** axe finds no serious or critical WCAG A/AA violations. */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, help: v.help, targets: v.nodes.map((n) => n.target.join(' ')) }));
  expect(serious).toEqual([]);
}
