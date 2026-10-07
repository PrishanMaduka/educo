'use client';

import { Moon, Sun, SunMoon } from 'lucide-react';
import { useId } from 'react';

import { IconButton } from '../components/IconButton';
import { cn } from '../lib/cn';

import { useStoredValue, writeStored } from './stored';
import { applyTheme, nextTheme, parseTheme, THEME_STORAGE_KEY, type ThemeChoice } from './theme';

export interface ThemeToggleProps {
  /** Accessible name, for example "Change theme". */
  label: string;
  /** Description of the current choice, for example "Theme: Dark". */
  describe: (choice: ThemeChoice) => string;
  className?: string;
}

const icons = { system: SunMoon, light: Sun, dark: Moon } as const;

/** Cycles system → light → dark, stores the choice and sets `data-theme` on <html>. The icon shows the current choice. */
export function ThemeToggle({ label, describe, className }: ThemeToggleProps) {
  const choice = parseTheme(useStoredValue(THEME_STORAGE_KEY));
  const descriptionId = useId();
  return (
    <>
      <IconButton
        icon={icons[choice]}
        label={label}
        aria-describedby={descriptionId}
        data-theme-choice={choice}
        className={cn(className)}
        onClick={() => {
          const next = nextTheme(choice);
          applyTheme(next);
          writeStored(THEME_STORAGE_KEY, next);
        }}
      />
      <span id={descriptionId} hidden>
        {describe(choice)}
      </span>
    </>
  );
}
