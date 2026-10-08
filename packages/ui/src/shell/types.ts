import type { ThemeChoice } from './theme';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ComponentType } from 'react';

export interface ShellNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Count badge, for example unread messages. */
  count?: number;
  /** Active only on this exact path (Home), not on paths below it. */
  exact?: boolean;
}

export interface ShellNavGroup {
  id: string;
  label: string;
  items: ShellNavItem[];
}

/** `staff` has the school's coral active item; `console` has the darker rail with the lilac one. */
export type ShellVariant = 'staff' | 'console';

/** A link component, such as Next's `Link`, so navigation stays client-side. */
export type ShellLinkComponent = ComponentType<ComponentProps<'a'> & { href: string }>;

/** Every string the shell shows. The app passes them from en.json. */
export interface ShellLabels {
  skipToContent: string;
  sidebar: string;
  nav: string;
  collapse: string;
  expand: string;
  openMenu: string;
  menuTitle: string;
  close: string;
  search: string;
  searchShortcut: string;
  paletteLabel: string;
  paletteEmpty: string;
  palettePages: string;
  askQuad: string;
  askQuadShortcut: string;
  themeToggle: string;
  themeCurrent: (choice: ThemeChoice) => string;
  notifications: string;
  profile: string;
  signOut: string;
}

export interface ShellUser {
  name: string;
  role: string;
}

export interface ShellBrand {
  title: string;
  subtitle: string;
  /** Small outlined tag after the title, for example "Console". */
  badge?: string;
}

/** Whether a nav item is the current page. */
export function isActiveHref(item: Pick<ShellNavItem, 'href' | 'exact'>, current: string): boolean {
  if (current === item.href) return true;
  return !item.exact && current.startsWith(`${item.href}/`);
}
