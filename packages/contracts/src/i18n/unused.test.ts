import { describe, expect, it } from 'vitest';

import { findUnusedKeys } from './unused';

const keys = ['nav.home', 'theme.light', 'theme.dark', 'students.count', 'app.name.parent'];

describe('findUnusedKeys', () => {
  it('reports keys no source mentions', () => {
    expect(findUnusedKeys(keys, { web: [], dart: [] }, {})).toEqual({ unused: keys, stale: [] });
  });

  it('counts a quoted key in web sources, in t() calls or typed key values', () => {
    const web = ["t('nav.home')", 'const k: MessageKey = "students.count";', 'x(`app.name.parent`)'];
    expect(findUnusedKeys(keys, { web, dart: [] }, {}).unused).toEqual(['theme.light', 'theme.dark']);
  });

  it('counts every key under a template prefix as used', () => {
    const web = ['t(`theme.${choice}`)'];
    expect(findUnusedKeys(['theme.light', 'themes.x'], { web, dart: [] }, {}).unused).toEqual([
      'themes.x',
    ]);
  });

  it('does not count a key that only appears inside a longer string', () => {
    expect(findUnusedKeys(['nav.home'], { web: ["'nav.home.extra'"], dart: [] }, {}).unused).toEqual([
      'nav.home',
    ]);
  });

  it('counts the camel-cased getter in Dart sources', () => {
    const dart = ['Text(l10n.navHome)', 'AppLocalizations.of(context).appNameParent'];
    expect(findUnusedKeys(['nav.home', 'app.name.parent', 'nav.homeX'], { web: [], dart }, {}).unused).toEqual([
      'nav.homeX',
    ]);
  });

  it('skips listed exceptions and reports exceptions that are used or missing', () => {
    const result = findUnusedKeys(
      ['students.count', 'nav.home'],
      { web: ["t('nav.home')"], dart: [] },
      { 'students.count': 'sample', 'nav.home': 'used', 'gone.key': 'missing' },
    );
    expect(result).toEqual({ unused: [], stale: ['nav.home', 'gone.key'] });
  });
});
