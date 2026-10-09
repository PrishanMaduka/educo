'use client';

import { useState, type ReactNode } from 'react';

import { CommandPalette, type CommandGroup } from '../components/CommandPalette';
import { cn } from '../lib/cn';
import { focusRing } from '../lib/motion';

import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { useStoredValue, writeStored } from './stored';
import { applyRail, RAIL_STORAGE_KEY } from './theme';
import { Topbar } from './Topbar';

import type {
  ShellBrand,
  ShellLabels,
  ShellLinkComponent,
  ShellNavGroup,
  ShellProfileMenu,
  ShellUser,
  ShellVariant,
} from './types';

export interface AppShellProps {
  variant: ShellVariant;
  brand: ShellBrand;
  user: ShellUser;
  groups: ShellNavGroup[];
  /** The current path, for the active nav item. */
  currentHref: string;
  labels: ShellLabels;
  linkComponent?: ShellLinkComponent;
  /** Goes to a page chosen in the search palette. */
  onNavigate: (href: string) => void;
  /** Bars under the top bar that stay in view, for example the support and preview banners. */
  banner?: ReactNode;
  /** Desktop-only top bar controls, for example **View as**. */
  actions?: ReactNode;
  /** The profile button's menu (Switch school, Sign out). */
  profileMenu?: ShellProfileMenu;
  /** The side bar's Sign out button. */
  onSignOut?: () => void;
  children: ReactNode;
}

/**
 * Staff and console shell (spec 03): a 248 px side bar that collapses to 72 px (remembered in localStorage),
 * a slide-over menu under 900 px, the sticky top bar and the Ctrl K palette. Content is capped at 1480 px.
 */
export function AppShell({
  variant,
  brand,
  user,
  groups,
  currentHref,
  labels,
  linkComponent,
  onNavigate,
  banner,
  actions,
  profileMenu,
  onSignOut,
  children,
}: AppShellProps) {
  const collapsed = useStoredValue(RAIL_STORAGE_KEY) === 'collapsed';
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const pages: CommandGroup[] = [
    {
      label: labels.palettePages,
      items: groups.flatMap((g) =>
        g.items.map((item) => ({
          id: item.href,
          label: item.label,
          hint: g.label,
          onSelect: () => {
            onNavigate(item.href);
          },
        })),
      ),
    },
  ];
  const rail = {
    variant,
    brand,
    user,
    groups,
    currentHref,
    navLabel: labels.nav,
    signOutLabel: labels.signOut,
    linkComponent,
    onSignOut,
  };

  return (
    // The grid width comes from <html data-rail> (set before paint), so a collapsed rail never jumps.
    <div
      data-rail-scope=""
      className="min-h-dvh min-[900px]:grid min-[900px]:grid-cols-[248px_minmax(0,1fr)] min-[900px]:rail-collapsed:grid-cols-[72px_minmax(0,1fr)]"
    >
      <a
        href="#main"
        className={cn(
          'sr-only z-50 rounded-full bg-surface px-4 py-2 font-bold text-ink shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3',
          focusRing,
        )}
      >
        {labels.skipToContent}
      </a>
      <aside
        aria-label={labels.sidebar}
        className="sticky top-0 z-30 hidden h-dvh overflow-hidden bg-rail text-rail-ink min-[900px]:block"
      >
        <Sidebar {...rail} collapsible collapsed={collapsed} />
      </aside>
      <MobileNav
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={labels.menuTitle}
        closeLabel={labels.close}
        menu={
          <Sidebar
            {...rail}
            onNavigate={() => {
              setMenuOpen(false);
            }}
          />
        }
      >
        <div className="flex min-w-0 flex-col">
          <div className="sticky top-0 z-20">
            <Topbar
              labels={labels}
              user={user}
              actions={actions}
              profileMenu={profileMenu}
              collapsed={collapsed}
              onToggleCollapsed={() => {
                applyRail(!collapsed);
                writeStored(RAIL_STORAGE_KEY, collapsed ? 'expanded' : 'collapsed');
              }}
              onOpenSearch={() => {
                setSearchOpen(true);
              }}
              onOpenAskQuad={() => {
                // TODO(M10): open the Ask Quad panel.
              }}
            />
            {banner}
          </div>
          <main
            id="main"
            tabIndex={-1}
            className="flex w-full max-w-[1480px] flex-col gap-5 p-6 outline-none max-[899px]:p-4"
          >
            {children}
          </main>
        </div>
      </MobileNav>
      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        groups={pages}
        placeholder={labels.search}
        label={labels.paletteLabel}
        emptyLabel={labels.paletteEmpty}
      />
    </div>
  );
}
