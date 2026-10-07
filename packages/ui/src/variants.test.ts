import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { compile } from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

/*
 * Compiles the custom variants with Tailwind and checks which elements the generated selectors match, so the
 * `dark:` variant agrees with the token CSS: the nearest data-theme wins, and the device setting applies only
 * where no ancestor chose light.
 */

interface Rules {
  /** Selector that applies regardless of the device setting. */
  always: string[];
  /** Selectors that apply only under `prefers-color-scheme: dark`. */
  deviceDark: string[];
}

/**
 * Flattens Tailwind's nested output (`.x { &:where(...) { ... } @media (...) { &... { ... } } }`) into the
 * selectors for one class, split by whether they sit inside the prefers-color-scheme block.
 */
function rulesFor(css: string, candidate: string): Rules {
  const cls = `.${candidate.replace(/:/g, '\\:')}`;
  const out: Rules = { always: [], deviceDark: [] };
  const walk = (text: string, selector: string, deviceDark: boolean): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) return;
      const head = text.slice(i, open).trim().split(';').pop()?.trim() ?? '';
      let depth = 1;
      let j = open + 1;
      for (; j < text.length && depth > 0; j += 1) {
        if (text[j] === '{') depth += 1;
        else if (text[j] === '}') depth -= 1;
      }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@media')) {
        walk(body, selector, deviceDark || head.includes('prefers-color-scheme: dark'));
      } else {
        const full = selector ? head.replace(/&/g, selector) : head;
        if (body.includes('{')) walk(body, full, deviceDark);
        else if (full.includes(cls)) (deviceDark ? out.deviceDark : out.always).push(full);
      }
      i = j;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), '', false);
  return out;
}

const matchesAny = (el: Element, selectors: string[]): boolean =>
  selectors.some((s) => el.matches(s));

// Vitest runs in the package folder (jsdom gives import.meta.url a non-file scheme).
const variants = readFileSync(resolve(process.cwd(), 'src/variants.css'), 'utf8');

let dark: Rules;
let railCollapsed: Rules;

beforeAll(async () => {
  const compiler = await compile(`@tailwind utilities;\n${variants}`);
  const css = compiler.build(['dark:underline', 'rail-collapsed:hidden']);
  dark = rulesFor(css, 'dark:underline');
  railCollapsed = rulesFor(css, 'rail-collapsed:hidden');
});

function mount(html: string, rootTheme?: 'light' | 'dark'): void {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-rail');
  if (rootTheme) document.documentElement.setAttribute('data-theme', rootTheme);
  document.body.innerHTML = html;
}
const probe = (): Element => {
  const el = document.querySelector('#probe');
  if (!el) throw new Error('no probe');
  return el;
};

describe('dark: variant', () => {
  it('applies under an explicit dark theme', () => {
    mount('<p id="probe" class="dark:underline"></p>', 'dark');
    expect(matchesAny(probe(), dark.always)).toBe(true);
  });

  it('does not apply inside a light container on a dark page', () => {
    mount('<div data-theme="light"><p id="probe" class="dark:underline"></p></div>', 'dark');
    expect(matchesAny(probe(), dark.always)).toBe(false);
    expect(matchesAny(probe(), dark.deviceDark)).toBe(false);
  });

  it('applies inside a dark container on a light page', () => {
    mount('<div data-theme="dark"><p id="probe" class="dark:underline"></p></div>', 'light');
    expect(matchesAny(probe(), dark.always)).toBe(true);
  });

  it('follows the device only where nothing chose light', () => {
    mount('<p id="probe" class="dark:underline"></p>');
    expect(matchesAny(probe(), dark.always)).toBe(false);
    expect(matchesAny(probe(), dark.deviceDark)).toBe(true);

    mount('<p id="probe" class="dark:underline"></p>', 'light');
    expect(matchesAny(probe(), dark.deviceDark)).toBe(false);

    mount('<div data-theme="light"><p id="probe" class="dark:underline"></p></div>');
    expect(matchesAny(probe(), dark.deviceDark)).toBe(false);
  });
});

describe('rail-collapsed: variant', () => {
  it('applies inside the side bar when <html> is collapsed', () => {
    mount('<aside data-rail-scope><p id="probe" class="rail-collapsed:hidden"></p></aside>');
    document.documentElement.setAttribute('data-rail', 'collapsed');
    expect(matchesAny(probe(), railCollapsed.always)).toBe(true);
  });

  it('does not apply when expanded or outside the side bar', () => {
    mount('<aside data-rail-scope><p id="probe" class="rail-collapsed:hidden"></p></aside>');
    expect(matchesAny(probe(), railCollapsed.always)).toBe(false);
    mount('<div><p id="probe" class="rail-collapsed:hidden"></p></div>');
    document.documentElement.setAttribute('data-rail', 'collapsed');
    expect(matchesAny(probe(), railCollapsed.always)).toBe(false);
  });
});
