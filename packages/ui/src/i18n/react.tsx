'use client';

import { I18nextProvider, useTranslation } from 'react-i18next';

import { i18n } from './index';

import type { ShellLabels } from '../shell/types';
import type { ReactNode } from 'react';

/** Gives client components `useTranslation()` with the shared en.json instance. */
export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/** Every shell string from en.json, for `AppShell`. */
export function useShellLabels(): ShellLabels {
  const { t } = useTranslation();
  return {
    skipToContent: t('shell.skipToContent'),
    sidebar: t('shell.sidebar.label'),
    nav: t('shell.nav.label'),
    collapse: t('shell.sidebar.collapse'),
    expand: t('shell.sidebar.expand'),
    openMenu: t('shell.menu.open'),
    menuTitle: t('shell.menu.title'),
    close: t('ui.drawer.close'),
    search: t('search.placeholder'),
    searchShortcut: t('search.shortcut'),
    paletteLabel: t('ui.palette.label'),
    paletteEmpty: t('ui.filter.empty'),
    palettePages: t('search.group.pages'),
    askQuad: t('askQuad.label'),
    askQuadShortcut: t('askQuad.shortcut'),
    themeToggle: t('theme.toggle'),
    themeCurrent: (choice) => t('theme.current', { theme: t(`theme.${choice}`) }),
    notifications: t('shell.notifications.open'),
    profile: t('shell.profile.open'),
    signOut: t('auth.signOut'),
  };
}
