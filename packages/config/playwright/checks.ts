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

/**
 * axe once nothing moves: cards and pages fade in, and axe would otherwise sample a colour
 * halfway (a brand-fill button read at 4.48:1 mid fade, in staff journey 19).
 */
export async function expectAccessibleOnceStill(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  );
  await expectNoSeriousA11yViolations(page);
}

/** Whether this run should write the review screenshots (`QUAD_SCREENSHOTS=1 pnpm e2e`). */
export const takeScreenshots = process.env.QUAD_SCREENSHOTS === '1';

/**
 * Saves a full-page screenshot to docs/screenshots/<milestone>/<name>-<width>-<scheme>.png at the repo root,
 * for comparing with the prototypes. Waits for fonts so the text is in Figtree.
 */
export async function saveScreenshot(
  page: Page,
  testInfo: TestInfo,
  milestone: string,
  name: string,
): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const width = page.viewportSize()?.width ?? 0;
  const file = new URL(
    `../../../docs/screenshots/${milestone}/${name}-${width}-${schemeOf(testInfo)}.png`,
    import.meta.url,
  );
  await page.screenshot({ path: file.pathname, fullPage: true, animations: 'disabled' });
}
