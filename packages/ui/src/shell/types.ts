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
  /** The profile menu's name for screen readers ("Your profile"). */
  profileMenu: string;
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
  /** The school's short name on the brand tile (spec 08: logo or initials), instead of the Quad mark. */
  initials?: string;
}

/** One choice in the profile menu. */
export interface ShellMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** A short note after the label, for example "Paused". */
  hint?: string;
  disabled?: boolean;
  onSelect: () => void;
}

/** A group of choices in the profile menu, with an optional heading ("Switch school"). */
export interface ShellMenuSection {
  id: string;
  label?: string;
  items: ShellMenuItem[];
}

/** The top bar's profile menu (spec 08): where the person is, then their choices. */
export interface ShellProfileMenu {
  /** Shown at the top, for example the current school. */
  heading?: string;
  sections: ShellMenuSection[];
}

/** Whether a nav item is the current page. */
export function isActiveHref(item: Pick<ShellNavItem, 'href' | 'exact'>, current: string): boolean {
  if (current === item.href) return true;
  return !item.exact && current.startsWith(`${item.href}/`);
}
