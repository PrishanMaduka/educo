'use client';

import { Bell, Menu, PanelLeft, Search, Sparkles } from 'lucide-react';

import { Avatar } from '../components/Avatar';
import { IconButton } from '../components/IconButton';
import { cn } from '../lib/cn';
import { focusRing, ICON_STROKE, transition } from '../lib/motion';

import { ThemeToggle } from './ThemeToggle';

import type { ShellLabels, ShellUser } from './types';

export interface TopbarProps {
  labels: ShellLabels;
  user: ShellUser;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}

/** Round 38 px buttons, 44 px on phones (prototype `.iconbtn`). */
const round =
  'size-[38px] rounded-full border-line bg-surface text-ink-2 hover:text-ink max-sm:size-11';

const kbd =
  'rounded-[5px] border border-b-2 border-line-strong bg-surface px-[5px] text-[11px] leading-[1.5] font-semibold text-ink-2';

/** Sticky, translucent top bar (spec 03 shell): menu or collapse, search (Ctrl K), Ask Quad, theme, notifications, profile. */
export function Topbar({
  labels,
  user,
  collapsed,
  onToggleCollapsed,
  onOpenMenu,
  onOpenSearch,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-dashed border-line-strong bg-canvas/85 px-6 py-2.5 backdrop-blur-[10px] max-[899px]:gap-2 max-[899px]:px-4">
      <IconButton
        icon={Menu}
        label={labels.openMenu}
        onClick={onOpenMenu}
        className={cn(round, 'min-[900px]:hidden')}
      />
      <IconButton
        icon={PanelLeft}
        label={collapsed ? labels.expand : labels.collapse}
        onClick={onToggleCollapsed}
        className={cn(round, 'max-[899px]:hidden')}
      />
      <button
        type="button"
        onClick={onOpenSearch}
        aria-keyshortcuts="Control+K Meta+K"
        className={cn(
          'flex h-[38px] max-w-[460px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 text-left text-ink-2 hover:border-line-strong',
          'max-sm:size-11 max-sm:flex-none max-sm:justify-center max-sm:px-0',
          transition,
          focusRing,
        )}
      >
        <Search aria-hidden="true" strokeWidth={ICON_STROKE} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate max-sm:sr-only">{labels.search}</span>
        <kbd aria-hidden="true" className={cn(kbd, 'max-[899px]:hidden')}>
          {labels.searchShortcut}
        </kbd>
      </button>
      <div className="flex-1 max-sm:flex-1" />
      <button
        type="button"
        className={cn(
          'inline-flex h-[38px] shrink-0 cursor-pointer items-center gap-[7px] rounded-full border border-line-strong bg-surface px-4 text-[13px] font-bold text-ink hover:bg-surface-2',
          'max-[860px]:w-[38px] max-[860px]:justify-center max-[860px]:px-0 max-sm:size-11',
          transition,
          focusRing,
        )}
      >
        <Sparkles
          aria-hidden="true"
          strokeWidth={ICON_STROKE}
          className="size-4 shrink-0 text-brand"
        />
        <span className="max-[860px]:sr-only">{labels.askQuad}</span>
        <kbd aria-hidden="true" className={cn(kbd, 'ml-1 max-[860px]:hidden')}>
          {labels.askQuadShortcut}
        </kbd>
      </button>
      <ThemeToggle label={labels.themeToggle} describe={labels.themeCurrent} className={round} />
      <IconButton icon={Bell} label={labels.notifications} className={round} />
      <button
        type="button"
        aria-label={labels.profile}
        className={cn(
          'flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full border-0 bg-transparent p-0 pl-1.5 text-left',
          focusRing,
        )}
      >
        <Avatar name={user.name} decorative className="max-sm:size-11" />
        <span className="max-[899px]:hidden">
          <span className="block text-[13px] leading-tight font-bold text-ink">{user.name}</span>
          <span className="block text-[11.5px] text-ink-2">{user.role}</span>
        </span>
      </button>
    </header>
  );
}
