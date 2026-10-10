import type { ComingSoonLabels } from '../_components/SignInEntry';
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

/** The coming-soon note's labels, for every Sign in entry before launch (D32 Pre-launch). */
export function comingSoonLabels(): ComingSoonLabels {
  return {
    badge: t('public.comingSoon.badge'),
    title: t('public.comingSoon.title'),
    body: t('public.comingSoon.body'),
    close: t('public.comingSoon.close'),
    bookDemo: t('public.cta.school'),
  };
}
