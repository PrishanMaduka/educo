/** The person's theme choice. "system" follows the device (prefers-color-scheme). */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** localStorage key for the theme choice. */
export const THEME_STORAGE_KEY = 'quad-theme';

/** localStorage key for the side bar ("collapsed" or "expanded"). */
export const RAIL_STORAGE_KEY = 'quad-rail';

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

/** Marks <html> with data-rail="collapsed" (or clears it), which the `rail-collapsed:` variant reads. */
export function applyRail(collapsed: boolean, root: HTMLElement = document.documentElement): void {
  if (collapsed) root.setAttribute('data-rail', 'collapsed');
  else root.removeAttribute('data-rail');
}

/**
 * Runs in <head> before paint: reads the stored theme and side bar choices and sets `data-theme` and
 * `data-rail` on <html>. It only sets attributes (no styling), so the CSS does the rest and the first paint
 * already has the right theme and side bar width.
 */
export const themeBootstrapScript = `try{var d=document.documentElement,s=localStorage,t=s.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')d.setAttribute('data-theme',t);if(s.getItem('${RAIL_STORAGE_KEY}')==='collapsed')d.setAttribute('data-rail','collapsed')}catch(e){}`;
