import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/** Spec 03 canvas colours (D34): light #F7F5F0 and dark #0F1330. */
export const CANVAS = { light: 'rgb(247, 245, 240)', dark: 'rgb(15, 19, 48)' } as const;

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

/** A serious or critical axe violation, as the checks report it. */
export interface SeriousViolation {
  id: string;
  help: string;
  targets: string[];
}

/** The serious or critical WCAG A/AA violations axe finds on the page now. */
export async function seriousA11yViolations(page: Page): Promise<SeriousViolation[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, help: v.help, targets: v.nodes.map((n) => n.target.join(' ')) }));
}

/** axe finds no serious or critical WCAG A/AA violations. */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  expect(await seriousA11yViolations(page)).toEqual([]);
}

/** What `accessibleOnceStill` needs of a page (a Playwright `Page`, or a stand-in in tests). */
export interface StillPage {
  waitForFunction: (pageFunction: () => boolean) => Promise<unknown>;
  evaluate: <R>(pageFunction: () => R) => Promise<R>;
}

/** Waits until no finite animation or transition runs (endless decorations never stop). */
function untilStill(page: StillPage): Promise<unknown> {
  return page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
}

/** The page's motion watcher: set once a transition or animation starts after `watchMotion`. */
interface MotionWatch {
  __quadMotion?: { started: boolean };
}

/**
 * The violations axe finds once nothing moves. If a transition or animation starts while axe runs
 * (data arriving mid-analysis, such as the roles that enable Invite staff in staff journey 19),
 * that result may hold a colour sampled halfway, so it waits for stillness again and runs axe once
 * more. `analyze` runs axe; tests pass a stand-in.
 */
export async function accessibleOnceStill(
  page: StillPage,
  analyze: () => Promise<SeriousViolation[]>,
): Promise<SeriousViolation[]> {
  await untilStill(page);
  await page.evaluate(() => {
    const scope = globalThis as MotionWatch;
    if (scope.__quadMotion) {
      scope.__quadMotion.started = false;
      return;
    }
    const watch = { started: false };
    scope.__quadMotion = watch;
    const mark = () => {
      watch.started = true;
    };
    // Capture, so a transition anywhere on the page counts even if something stops its bubbling.
    document.addEventListener('transitionstart', mark, true);
    document.addEventListener('animationstart', mark, true);
  });
  const first = await analyze();
  const moved = await page.evaluate(
    () => (globalThis as MotionWatch).__quadMotion?.started === true,
  );
  if (!moved) return first;
  await untilStill(page);
  return analyze();
}

/**
 * axe once nothing moves: cards and pages fade in, and axe would otherwise sample a colour
 * halfway (a brand-fill button read at 4.48:1 mid fade, in staff journey 19). Endless
 * decorations are not waited for, since they never stop: the evening greeting's twinkling stars
 * (`gs-star`, D38) would otherwise hang every signed-in check run after dark in Colombo.
 */
export async function expectAccessibleOnceStill(page: Page): Promise<void> {
  expect(await accessibleOnceStill(page, () => seriousA11yViolations(page))).toEqual([]);
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
