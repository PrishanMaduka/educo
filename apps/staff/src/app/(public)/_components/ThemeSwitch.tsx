'use client';

import { cn } from '@quad/ui';
import {
  applyTheme,
  parseTheme,
  THEME_STORAGE_KEY,
  useStoredValue,
  writeStored,
} from '@quad/ui/theme';
import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { focusRing } from './styles';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeToScheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** Whether the page shows dark: the visitor's choice, else the device setting. */
function useIsDark(): boolean {
  const choice = parseTheme(useStoredValue(THEME_STORAGE_KEY));
  const systemDark = useSyncExternalStore(
    subscribeToScheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
  return choice === 'system' ? systemDark : choice === 'dark';
}

export interface ThemeSwitchLabels {
  toDark: string;
  toLight: string;
  darkMode: string;
  lightMode: string;
}

/**
 * Switches the landing page between light and dark (prototype theme button). The choice is stored
 * like the apps' theme (`quad-theme`), so the portal opens in the same theme.
 */
export function ThemeSwitch({
  labels,
  variant,
  className,
}: {
  labels: ThemeSwitchLabels;
  variant: 'icon' | 'menu';
  className?: string;
}) {
  const isDark = useIsDark();
  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    writeStored(THEME_STORAGE_KEY, next);
  };
  const label = isDark ? labels.toLight : labels.toDark;
  if (variant === 'menu') {
    return (
      <button type="button" aria-label={label} onClick={toggle} className={className}>
        {isDark ? labels.lightMode : labels.darkMode}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={toggle}
      className={cn(
        'grid size-10 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
        focusRing,
        className,
      )}
    >
      <Sun aria-hidden="true" strokeWidth={2.2} className="size-5 dark:hidden" />
      <Moon aria-hidden="true" strokeWidth={2.2} className="hidden size-5 dark:block" />
    </button>
  );
}
