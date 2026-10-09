'use client';

import * as Popover from '@radix-ui/react-popover';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { cn } from '../lib/cn';
import { uiText } from '../lib/defaults';
import { focusRing, ICON_STROKE, transition } from '../lib/motion';

import { IconButton } from './IconButton';

export interface ActionMenuItem {
  id: string;
  /** Says what happens ("Reset password", "Deactivate"). */
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  /** Deactivate, delete and other actions that take something away. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

export interface ActionMenuProps {
  /** Names the button and the menu, for example "More actions for Amaya Perera". */
  label?: string;
  items: readonly ActionMenuItem[];
  className?: string;
}

/**
 * A row's "more actions" button and its menu: a popover of buttons, so focus moves in, Escape
 * closes it and focus returns to the button. A choice closes the menu and puts focus back on the
 * button first, then runs, so a drawer it opens returns focus there too. No items, no button.
 */
export function ActionMenu({
  label = uiText['ui.actionMenu.label'],
  items,
  className,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const chosen = useRef<(() => void) | null>(null);
  if (items.length === 0) return null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <IconButton
          ref={triggerRef}
          icon={MoreHorizontal}
          label={label}
          variant="ghost"
          size="sm"
          className={className}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          role="dialog"
          aria-label={label}
          align="end"
          sideOffset={6}
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            const run = chosen.current;
            chosen.current = null;
            if (run === null) return;
            event.preventDefault();
            triggerRef.current?.focus();
            run();
          }}
          className="z-[200] flex w-[min(240px,calc(100vw-24px))] flex-col gap-px rounded-[14px] border border-line bg-surface p-1.5 shadow-lg outline-none"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  chosen.current = item.onSelect;
                  setOpen(false);
                }}
                className={cn(
                  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-[9px] border-0 bg-transparent px-2.5 py-2 text-left text-[13.5px] font-semibold hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60 max-sm:min-h-11',
                  item.tone === 'danger' ? 'text-bad' : 'text-ink',
                  transition,
                  focusRing,
                )}
              >
                {Icon ? (
                  <Icon
                    aria-hidden="true"
                    strokeWidth={ICON_STROKE}
                    className="size-4 shrink-0 text-current"
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
