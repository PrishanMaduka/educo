import type { ThemeSwitchLabels } from '../_components/ThemeSwitch';

import { t } from '@/i18n';

/** The theme button's labels, shared by every public page. */
export function themeSwitchLabels(): ThemeSwitchLabels {
  return {
    toDark: t('public.theme.toDark'),
    toLight: t('public.theme.toLight'),
    darkMode: t('public.theme.darkMode'),
    lightMode: t('public.theme.lightMode'),
  };
}
