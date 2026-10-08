/*
 * The theme choice on its own (`@quad/ui/theme`), for pages that need the stored theme without the
 * app shell, such as the public landing page and the root layout's bootstrap script.
 */
export { readStored, useStoredValue, writeStored } from './stored';
export {
  applyTheme,
  parseTheme,
  themeBootstrapScript,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from './theme';
