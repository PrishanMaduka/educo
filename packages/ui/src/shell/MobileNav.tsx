'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '../lib/cn';
import { focusRing, ICON_STROKE } from '../lib/motion';

import type { ReactNode } from 'react';

export interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}

/** The side bar as a slide-over from the left on screens under 900 px. Focus is trapped while it is open. */
export function MobileNav({ open, onOpenChange, title, closeLabel, children }: MobileNavProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
