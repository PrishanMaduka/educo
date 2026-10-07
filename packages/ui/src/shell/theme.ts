/** The person's theme choice. "system" follows the device (prefers-color-scheme). */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** localStorage key for the theme choice. */
export const THEME_STORAGE_KEY = 'quad-theme';

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

/** Reads a stored value; anything unknown means "system". */
export function parseTheme(value: string | null): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** The toggle cycles system → light → dark → system. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  switch (choice) {
    case 'system':
      return 'light';
    case 'light':
      return 'dark';
    case 'dark':
      return 'system';
  }
}

/** Sets `data-theme` on <html>, or removes it for "system" so the token CSS follows the device. */
export function applyTheme(
  choice: ThemeChoice,
  root: HTMLElement = document.documentElement,
): void {
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/**
 * Runs in <head> before paint: reads the stored choice and sets `data-theme` on <html>. It only sets the
 * attribute (no styling), so the token CSS does the rest and the first paint is already in the right theme.
 */
export const themeBootstrapScript = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
