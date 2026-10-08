import { describe, expect, it } from 'vitest';

import {
  applyTheme,
  nextTheme,
  parseTheme,
  RAIL_STORAGE_KEY,
  themeBootstrapScript,
  THEME_STORAGE_KEY,
} from './theme';

describe('theme', () => {
  it('cycles system, light, dark and back', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });

  it('treats anything unknown as system', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme(null)).toBe('system');
    expect(parseTheme('sepia')).toBe('system');
  });

  it('sets data-theme for light and dark and removes it for system', () => {
    const root = document.createElement('html');
    applyTheme('dark', root);
    expect(root.getAttribute('data-theme')).toBe('dark');
    applyTheme('system', root);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  describe('bootstrap script', () => {
    const run = (): void => {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.removeAttribute('data-rail');
      // eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the exact inline script the layout ships
      const script = new Function(themeBootstrapScript) as () => void;
      script();
    };

    it('applies a stored choice before paint', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      run();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('leaves system and junk values to the device setting', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'system');
      run();
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
      localStorage.setItem(THEME_STORAGE_KEY, '<script>');
      run();
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });

    it('marks a collapsed side bar on <html> before paint', () => {
      localStorage.setItem(RAIL_STORAGE_KEY, 'collapsed');
      run();
      expect(document.documentElement.getAttribute('data-rail')).toBe('collapsed');
      localStorage.setItem(RAIL_STORAGE_KEY, 'expanded');
      run();
      expect(document.documentElement.hasAttribute('data-rail')).toBe(false);
    });

    it('only sets the attribute (no styles)', () => {
      expect(themeBootstrapScript).not.toMatch(/style|className|classList/);
    });
  });
});
