import { camelCase } from './build';

export interface KeySources {
  /** TypeScript sources of the web apps, the API and packages/ui (keys appear as quoted strings). */
  web: string[];
  /** Dart sources of the parent app (keys appear as camel-cased AppLocalizations getters). */
  dart: string[];
}

export interface UnusedKeysResult {
  /** Keys in the catalogue that no source uses and that are not listed as exceptions. */
  unused: string[];
  /** Exceptions that are used after all or no longer in the catalogue, so the list stays honest. */
  stale: string[];
}

// A whole quoted string that looks like a key: `t('nav.home')`, `roleKey: 'role.schoolAdmin'`.
const QUOTED = /(['"`])([\w.-]+)\1/g;
// The static start of a template key: t(`theme.${choice}`) uses every `theme.*` key.
const TEMPLATE_PREFIX = /`([\w-]+(?:\.[\w-]+)*\.)\$\{/g;
// The app reads strings as `l10n.x` (`final l10n = AppLocalizations.of(context)`) or directly as
// `AppLocalizations.of(context).x`; any other `.x` (textTheme.title) is not a string lookup.
const DART_GETTER = /(?:\bl10n|\bAppLocalizations\.of\([^)]*\)!?)\s*\??\.\s*([A-Za-z_]\w*)/g;

/**
 * Removes `//` and `/* *\/` comments (TypeScript and Dart) so commented-out code does not count.
 * Quoted strings are skipped, so a `//` inside a URL is kept.
 */
export function stripComments(source: string): string {
  let out = '';
  let quote: string | undefined;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] ?? '';
    if (quote !== undefined) {
      out += char;
      if (char === '\\') {
        out += source[i + 1] ?? '';
        i += 1;
      } else if (char === quote) {
        quote = undefined;
      }
    } else if (char === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end - 1;
    } else if (char === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 1;
      out += ' ';
    } else {
      if (char === "'" || char === '"' || char === '`') quote = char;
      out += char;
    }
  }
  return out;
}

const matches = (sources: string[], pattern: RegExp, group: number): Set<string> => {
  const found = new Set<string>();
  for (const source of sources) {
    for (const match of stripComments(source).matchAll(pattern)) {
      const value = match[group];
      if (value !== undefined) found.add(value);
    }
  }
  return found;
};

/**
 * Catalogue keys that nothing uses (spec 02, `i18n:build`). `exceptions` maps a key that is kept on
 * purpose to the reason, so every exception is written down next to the check.
 */
export function findUnusedKeys(
  keys: string[],
  sources: KeySources,
  exceptions: Record<string, string>,
): UnusedKeysResult {
  const quoted = matches(sources.web, QUOTED, 2);
  const prefixes = [...matches(sources.web, TEMPLATE_PREFIX, 1)];
  const getters = matches(sources.dart, DART_GETTER, 1);

  const isUsed = (key: string): boolean =>
    quoted.has(key) ||
    prefixes.some((prefix) => key.startsWith(prefix)) ||
    getters.has(camelCase(key));

  const known = new Set(keys);
  return {
    unused: keys.filter((key) => !(key in exceptions) && !isUsed(key)),
    stale: Object.keys(exceptions).filter((key) => !known.has(key) || isUsed(key)),
  };
}
