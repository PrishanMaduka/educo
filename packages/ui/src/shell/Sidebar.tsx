'use client';

import { QuadMark } from '@quad/tokens/logo';
import { LogOut } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Avatar } from '../components/Avatar';
import { Tooltip } from '../components/Tooltip';
import { cn } from '../lib/cn';
import { focusRing, ICON_STROKE, transition } from '../lib/motion';

import {
  isActiveHref,
  type ShellBrand,
  type ShellLinkComponent,
  type ShellNavGroup,
  type ShellNavItem,
  type ShellUser,
  type ShellVariant,
} from './types';

export interface SidebarProps {
  variant: ShellVariant;
  brand: ShellBrand;
  user: ShellUser;
  groups: ShellNavGroup[];
  currentHref: string;
  /**
   * The desktop side bar: it narrows to icons (72 px) when <html data-rail="collapsed">, through the
   * `rail-collapsed:` variant, so the first paint is right before React knows the stored choice.
   */
  collapsible?: boolean;
  /** The stored choice, once known: collapsed links get tooltips. Layout does not depend on it. */
  collapsed?: boolean;
  navLabel: string;
  signOutLabel: string;
  linkComponent?: ShellLinkComponent;
  /** Called after a nav link is followed (the phone menu closes itself). */
  onNavigate?: () => void;
}

/*
 * Active item (spec 03 shell, prototype `.nav a.on`). The staff prototype puts white text on the school's
 * rail-active coral, which is 4.09:1 in light and 2.54:1 in dark, so the staff pill uses the brand-fill pair
 * (4.54:1 and 6.44:1) instead. The console keeps its lilac pill with rail-coloured text (5.19:1 and 8.06:1).
 */
const activeItem: Record<ShellVariant, string> = {
  staff: 'bg-brand-fill text-brand-ink shadow-md hover:bg-brand-fill',
  console: 'bg-gold font-extrabold text-rail shadow-md hover:bg-gold',
};
const activeDot: Record<ShellVariant, string> = { staff: 'bg-gold', console: 'bg-rail' };
/* Prototype `.brand b`: the school's name wraps to two lines; the console's short "Quad" title sits on one. */
const brandTitle: Record<ShellVariant, string> = {
  staff: 'line-clamp-2 text-[14.5px] leading-[1.25]',
  console: 'flex items-center text-lg leading-tight whitespace-nowrap',
};
const logoTile: Record<ShellVariant, string> = {
  staff: 'bg-brand',
  console: 'bg-rail-2 ring-1 ring-rail-ink/25 ring-inset',
};

function NavLink({
  item,
  active,
  collapsible,
  collapsed,
  variant,
  linkComponent: Link = 'a',
  onNavigate,
}: {
  item: ShellNavItem;
  active: boolean;
  collapsible: boolean;
  collapsed: boolean;
  variant: ShellVariant;
  linkComponent?: ShellLinkComponent | 'a';
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'relative flex min-h-10 items-center gap-3 rounded-full px-3 py-[9px] font-semibold whitespace-nowrap text-rail-ink hover:bg-rail-2 max-[899px]:min-h-11',
        transition,
        focusRing,
        collapsible && 'rail-collapsed:justify-center rail-collapsed:px-0',
        active && activeItem[variant],
      )}
    >
      <Icon aria-hidden="true" strokeWidth={ICON_STROKE} className="size-[18px] shrink-0" />
      <span className={cn('min-w-0 truncate', collapsible && 'rail-collapsed:sr-only')}>
        {item.label}
      </span>
      {item.count !== undefined ? (
        <span
          className={cn(
            'ml-auto shrink-0 rounded-full bg-rail-ink/12 px-[7px] py-px text-[11px] font-bold tabular-nums',
            active && 'mr-3.5 bg-current/20',
            collapsible && 'rail-collapsed:hidden',
          )}
        >
          {item.count}
        </span>
      ) : null}
      {active ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1/2 right-3 -mt-[3px] size-1.5 rounded-full',
            activeDot[variant],
            collapsible && 'rail-collapsed:hidden',
          )}
        />
      ) : null}
    </Link>
  );
  return collapsible && collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function Group({
  group,
  children,
  collapsible,
}: {
  group: ShellNavGroup;
  children: ReactNode;
  collapsible: boolean;
}) {
  const id = useId();
  return (
    <div className="mt-3.5 first:mt-1">
      <div
        id={id}
        className={cn(
          'px-3 pb-1.5 text-[11px] font-extrabold tracking-[0.12em] whitespace-nowrap text-rail-ink-2 uppercase',
          collapsible && 'rail-collapsed:sr-only',
        )}
      >
        {group.label}
      </div>
      <ul aria-labelledby={id} className="m-0 flex list-none flex-col gap-0.5 p-0">
        {children}
      </ul>
    </div>
  );
}

/** The rail's contents: brand, grouped navigation and the signed-in person. Used by the side bar and the phone menu. */
export function Sidebar({
  variant,
  brand,
  user,
  groups,
  currentHref,
  collapsible = false,
  collapsed = false,
  navLabel,
  signOutLabel,
  linkComponent,
  onNavigate,
}: SidebarProps) {
  return (
    <div className="rail-glow flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex min-h-16 items-center gap-2.5 px-[18px] pt-[18px] pb-3.5',
          collapsible && 'rail-collapsed:justify-center rail-collapsed:px-0',
        )}
      >
        <span
          className={cn(
            'grid size-[34px] shrink-0 place-items-center rounded-xl',
            logoTile[variant],
          )}
        >
          <QuadMark variant="white" size={25} aria-hidden="true" />
        </span>
        <div className={cn('min-w-0', collapsible && 'rail-collapsed:sr-only')}>
          <p
            className={cn(
              'm-0 font-extrabold tracking-[-0.01em] text-rail-ink',
              brandTitle[variant],
            )}
          >
            {brand.title}
            {brand.badge ? (
              <span className="ml-2 rounded-full border border-gold/65 px-[7px] text-[9px] leading-[1.4] font-extrabold tracking-[0.14em] text-gold uppercase">
                {brand.badge}
              </span>
            ) : null}
          </p>
          <p className="m-0 line-clamp-2 text-[11px] leading-[1.35] font-semibold text-rail-ink-2">
            {brand.subtitle}
          </p>
        </div>
      </div>
      <nav
        aria-label={navLabel}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-2.5 pt-1.5 pb-4 [scrollbar-width:thin]',
          collapsible && 'rail-collapsed:px-3',
        )}
      >
        {groups.map((group) => (
          <Group key={group.id} group={group} collapsible={collapsible}>
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActiveHref(item, currentHref)}
                  collapsible={collapsible}
                  collapsed={collapsed}
                  variant={variant}
                  linkComponent={linkComponent}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </Group>
        ))}
      </nav>
      <div
        className={cn(
          'mx-3 flex items-center gap-2.5 border-t border-dashed border-rail-ink/20 px-1.5 py-3.5',
          collapsible && 'rail-collapsed:mx-2 rail-collapsed:flex-col rail-collapsed:px-0',
        )}
      >
        <Avatar name={user.name} size="sm" decorative />
        <div className={cn('min-w-0 flex-1 text-xs', collapsible && 'rail-collapsed:sr-only')}>
          <p className="m-0 truncate font-bold text-rail-ink">{user.name}</p>
          <p className="m-0 truncate text-rail-ink-2">{user.role}</p>
        </div>
        <button
          type="button"
          aria-label={signOutLabel}
          className={cn(
            'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-rail-ink/20 bg-transparent text-rail-ink hover:bg-rail-2 max-[899px]:size-11',
            transition,
            focusRing,
          )}
        >
          <LogOut aria-hidden="true" strokeWidth={ICON_STROKE} className="size-4" />
        </button>
      </div>
    </div>
  );
}
