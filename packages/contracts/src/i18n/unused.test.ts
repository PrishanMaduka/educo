import { describe, expect, it } from 'vitest';

import { findUnusedKeys } from './unused';

const keys = ['nav.home', 'theme.light', 'theme.dark', 'students.count', 'app.name.parent'];

describe('findUnusedKeys', () => {
  it('reports keys no source mentions', () => {
    expect(findUnusedKeys(keys, { web: [], dart: [] }, {})).toEqual({ unused: keys, stale: [] });
  });

  it('counts a quoted key in web sources, in t() calls or typed key values', () => {
    const web = [
      "t('nav.home')",
      'const k: MessageKey = "students.count";',
      'x(`app.name.parent`)',
    ];
    expect(findUnusedKeys(keys, { web, dart: [] }, {}).unused).toEqual([
      'theme.light',
      'theme.dark',
    ]);
  });

  it('counts every key under a template prefix as used', () => {
    const web = ['t(`theme.${choice}`)'];
    expect(findUnusedKeys(['theme.light', 'themes.x'], { web, dart: [] }, {}).unused).toEqual([
      'themes.x',
    ]);
  });

  it('does not count a key that only appears inside a longer string', () => {
    expect(
      findUnusedKeys(['nav.home'], { web: ["'nav.home.extra'"], dart: [] }, {}).unused,
    ).toEqual(['nav.home']);
  });

  it('counts the camel-cased getter in Dart sources', () => {
    const dart = ['Text(l10n.navHome)', 'AppLocalizations.of(context).appNameParent'];
    expect(
      findUnusedKeys(['nav.home', 'app.name.parent', 'nav.homeX'], { web: [], dart }, {}).unused,
    ).toEqual(['nav.homeX']);
  });

  it('skips listed exceptions and reports exceptions that are used or missing', () => {
    const result = findUnusedKeys(
      ['students.count', 'nav.home'],
      { web: ["t('nav.home')"], dart: [] },
      { 'students.count': 'sample', 'nav.home': 'used', 'gone.key': 'missing' },
    );
    expect(result).toEqual({ unused: [], stale: ['nav.home', 'gone.key'] });
  });

  it('counts only AppLocalizations getters, not any member with the same name', () => {
    const dart = ['Text(title, style: textTheme.title)', 'widget.navHome'];
    expect(findUnusedKeys(['title', 'nav.home'], { web: [], dart }, {}).unused).toEqual([
      'title',
      'nav.home',
    ]);
  });

  it('counts AppLocalizations.of(context) with or without !', () => {
    const dart = ['AppLocalizations.of(context)!.title', 'AppLocalizations.of(ctx) .navHome'];
    expect(findUnusedKeys(['title', 'nav.home'], { web: [], dart }, {}).unused).toEqual([]);
  });

  it('ignores keys that only appear in comments', () => {
    const web = [
      "// t('nav.home')",
      "/* t('theme.light')\n */ const x = 1;",
      '/** `theme.${x}` */',
    ];
    const dart = ['// l10n.studentsCount', '/* l10n.appNameParent */'];
    expect(findUnusedKeys(keys, { web, dart }, {}).unused).toEqual(keys);
  });

  it('keeps code after a // inside a string', () => {
    const web = ["const url = 'https://quad-edu.com'; t('nav.home');"];
    const dart = ["final u = 'https://x'; l10n.themeDark;"];
    expect(findUnusedKeys(['nav.home', 'theme.dark'], { web, dart }, {}).unused).toEqual([]);
  });
});
