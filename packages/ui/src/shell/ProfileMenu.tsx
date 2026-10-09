'use client';

import * as Popover from '@radix-ui/react-popover';
import { useId, useState } from 'react';

import { Avatar } from '../components/Avatar';
import { cn } from '../lib/cn';
import { focusRing, ICON_STROKE, transition } from '../lib/motion';

import type { ShellLabels, ShellProfileMenu, ShellUser } from './types';

export interface ProfileMenuProps {
  user: ShellUser;
  menu: ShellProfileMenu;
  labels: Pick<ShellLabels, 'profile' | 'profileMenu'>;
}

/**
 * The top bar's profile button and its menu (spec 08; prototype `.me`): the person, where they
 * are, then grouped choices such as Switch school and Sign out. A popover of buttons, so focus
 * moves in, Escape closes it and focus returns to the button. A choice closes the menu first.
 */
export function ProfileMenu({ user, menu, labels }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={labels.profile}
        className={cn(
          'flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full border-0 bg-transparent p-0 pl-1.5 text-left',
          focusRing,
        )}
      >
        <Avatar name={user.name} decorative className="max-[899px]:size-11" />
        <span className="max-[899px]:hidden">
          <span className="block text-[13px] leading-tight font-bold text-ink">{user.name}</span>
          <span className="block text-[11.5px] text-ink-2">{user.role}</span>
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          role="dialog"
          aria-label={labels.profileMenu}
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[200] flex w-[min(300px,calc(100vw-24px))] flex-col rounded-[14px] border border-line bg-surface p-1.5 shadow-lg outline-none"
        >
          <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5">
            <Avatar name={user.name} decorative />
            <div className="min-w-0">
              <p className="m-0 truncate text-[13.5px] font-bold text-ink">{user.name}</p>
              <p className="m-0 truncate text-xs text-ink-2">{user.role}</p>
              {menu.heading ? (
                <p className="m-0 truncate text-xs font-semibold text-ink-2">{menu.heading}</p>
              ) : null}
            </div>
          </div>
          {menu.sections.map((section) => (
            <MenuSection
              key={section.id}
              section={section}
              headingId={`${headingId}-${section.id}`}
              onChosen={() => {
                setOpen(false);
              }}
            />
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MenuSection({
  section,
  headingId,
  onChosen,
}: {
  section: ShellProfileMenu['sections'][number];
  headingId: string;
  onChosen: () => void;
}) {
  if (section.items.length === 0) return null;
  return (
    <div className="border-t border-line pt-1.5 mt-1">
      {section.label ? (
        <p
          id={headingId}
          className="m-0 px-2.5 pt-1 pb-1 text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase"
        >
          {section.label}
        </p>
      ) : null}
      <ul
        aria-labelledby={section.label ? headingId : undefined}
        className="m-0 flex list-none flex-col gap-px p-0"
      >
        {section.items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  onChosen();
                  item.onSelect();
                }}
                className={cn(
                  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[9px] border-0 bg-transparent px-2.5 py-2 text-left text-[13.5px] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60 max-[899px]:min-h-11',
                  transition,
                  focusRing,
                )}
              >
                {Icon ? (
                  <Icon
                    aria-hidden="true"
                    strokeWidth={ICON_STROKE}
                    className="size-4 shrink-0 text-ink-2"
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint ? (
                  <span className="shrink-0 text-xs font-semibold text-ink-2">{item.hint}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
