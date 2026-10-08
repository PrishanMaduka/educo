import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yViolations, expectNoSideScroll } from '@quad/config/playwright/checks';

/** Every value export (components, hooks, helpers and formatters; not types) in packages/ui/src/index.ts. */
function exportedNames(): string[] {
  const source = readFileSync(
    new URL('../../../packages/ui/src/index.ts', import.meta.url),
    'utf8',
  );
  const names = new Set<string>();
  for (const block of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of (block[1] ?? '').split(',')) {
      const name = raw.trim();
      if (/^[A-Za-z]\w*$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

test.describe('/design style guide', () => {
  const components = exportedNames();

  test('lists at least the core components', () => {
    expect(components).toEqual(
      expect.arrayContaining(['Button', 'Drawer', 'GreetingScene', 'useToast', 'formatMoney']),
    );
  });

  test('has a heading for every export, shown in light and dark', async ({ page }) => {
    await page.goto('/design');
    for (const name of components) {
      const heading = page.getByRole('heading', { level: 2, name, exact: true });
      await expect(heading, `${name} has a style-guide entry`).toHaveCount(1);
      const section = page.locator('section', { has: heading });
      await expect(section.locator('[data-theme="light"]')).toHaveCount(1);
      await expect(section.locator('[data-theme="dark"]')).toHaveCount(1);
    }
    await expectNoSideScroll(page);
  });

  test('the light and dark samples use their own canvas', async ({ page }) => {
    await page.goto('/design');
    const first = page.locator('section[aria-labelledby]').first();
    await expect(first.locator('[data-theme="light"]')).toHaveCSS(
      'background-color',
      'rgb(250, 248, 245)',
    );
    await expect(first.locator('[data-theme="dark"]')).toHaveCSS(
      'background-color',
      'rgb(19, 20, 42)',
    );
  });

  test('shows the colour tokens and passes axe', async ({ page }) => {
    await page.goto('/design');
    const tokens = page.locator('section', {
      has: page.getByRole('heading', { level: 2, name: 'Colour tokens' }),
    });
    await expect(tokens.getByText('brand-fill', { exact: true })).toHaveCount(2);
    await expectNoSeriousA11yViolations(page);
  });
});
