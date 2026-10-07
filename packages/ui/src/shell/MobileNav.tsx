'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { focusRing, ICON_STROKE } from '../lib/motion';

/** The shell's wide-screen breakpoint: from here the side bar is shown and the menu is not needed. */
const WIDE = '(min-width: 900px)';

export interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  /** What the slide-over shows (the side bar's contents). */
  menu: ReactNode;
  /** The rest of the shell. It must contain the `MobileNavTrigger`, so focus returns to it on close. */
  children: ReactNode;
}

/** The menu button. Use with `asChild` around the shell's own button. */
export const MobileNavTrigger = Dialog.Trigger;

/**
 * The side bar as a slide-over from the left on screens under 900 px. Focus is trapped while it is open and
 * goes back to the menu button when it closes. It closes itself if the screen grows past 900 px.
 */
export function MobileNav({
  open,
  onOpenChange,
  title,
  closeLabel,
  menu,
  children,
}: MobileNavProps) {
  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return;
    const wide = window.matchMedia(WIDE);
    const closeIfWide = (): void => {
      if (wide.matches) onOpenChange(false);
    };
    closeIfWide();
    wide.addEventListener('change', closeIfWide);
    return () => {
      wide.removeEventListener('change', closeIfWide);
    };
  }, [open, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
      <Dialog.Portal>
        <Dialog.Overlay className="quad-fade-in fixed inset-0 z-40 bg-ink/45 min-[900px]:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="quad-slide-in-left fixed inset-y-0 left-0 z-50 flex w-[min(264px,calc(100vw-48px))] flex-col bg-rail text-rail-ink shadow-lg outline-none min-[900px]:hidden"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Close
            aria-label={closeLabel}
            className={cn(
              'absolute top-3 right-3 z-10 grid size-11 cursor-pointer place-items-center rounded-full bg-transparent text-rail-ink hover:bg-rail-2',
              focusRing,
            )}
          >
            <X aria-hidden="true" strokeWidth={ICON_STROKE} className="size-[18px]" />
          </Dialog.Close>
          {menu}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
