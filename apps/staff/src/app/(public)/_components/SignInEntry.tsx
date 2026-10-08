'use client';

import { cn } from '@quad/ui';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { button, focusRing } from './styles';

export interface ComingSoonLabels {
  badge: string;
  title: string;
  body: string;
  close: string;
  bookDemo: string;
}

/**
 * A Sign in entry on the landing page. Before launch (NEXT_PUBLIC_QUAD_PRELAUNCH) it opens a small
 * "coming soon" note instead of signing in (decision log, 2026-10-08): a modal `<dialog>`, which
 * keeps focus inside and closes with Escape; focus returns to the button that opened it.
 */
export function SignInEntry({
  label,
  look,
  menuClassName,
  prelaunch,
  comingSoon,
}: {
  label: string;
  look: 'nav' | 'menu' | 'link';
  /** The class for the menu look, from the menu. */
  menuClassName?: string;
  prelaunch: boolean;
  comingSoon: ComingSoonLabels;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  // Closing to book a demo moves focus to the form instead of back to Sign in.
  const returnsFocus = useRef(true);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const returnFocus = () => {
      if (returnsFocus.current) openerRef.current?.focus();
      returnsFocus.current = true;
    };
    dialog.addEventListener('close', returnFocus);
    return () => {
      dialog.removeEventListener('close', returnFocus);
    };
  }, []);

  const className = {
    nav: cn(
      'cursor-pointer rounded-md border-0 bg-transparent p-0 text-[15px] font-medium text-site-on-navy-2 no-underline hover:text-site-on-navy',
      focusRing,
    ),
    menu: menuClassName,
    link: cn(
      'cursor-pointer border-0 bg-transparent p-0 font-bold text-site-lime underline underline-offset-[3px]',
      focusRing,
    ),
  }[look];

  if (!prelaunch) {
    // TODO(M1b): open the sign-in dialog (spec 19 "Sign-in"); until then the portal handles it.
    return (
      <a href="/app" className={className}>
        {label}
      </a>
    );
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        aria-haspopup="dialog"
        className={className}
        onClick={() => dialogRef.current?.showModal()}
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="m-auto w-[min(440px,calc(100%-32px))] rounded-[28px] border-0 bg-site-sheet-bg p-7 text-left font-site text-site-sheet-ink shadow-[0_40px_80px_-30px_var(--quad-site-card-shadow)] backdrop:bg-site-backdrop backdrop:backdrop-blur-[3px]"
      >
        <form method="dialog" className="absolute top-3.5 right-3.5 m-0">
          <button
            type="submit"
            aria-label={comingSoon.close}
            className={cn(
              'grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-site-sheet-ink-2 hover:bg-site-sheet-2',
              focusRing,
            )}
          >
            <X aria-hidden="true" strokeWidth={2.2} className="size-5" />
          </button>
        </form>
        <p className="m-0 inline-block rounded-full bg-site-lime px-3 py-1 text-[13px] font-bold text-site-on-vivid">
          {comingSoon.badge}
        </p>
        <h2
          id={titleId}
          className="m-0 mt-3.5 pr-10 text-[28px] leading-[1.1] font-extrabold tracking-[-.03em] text-balance"
        >
          {comingSoon.title}
        </h2>
        <p id={bodyId} className="m-0 mt-2 text-[15px] leading-[1.55] text-site-sheet-ink-2">
          {comingSoon.body}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="#demo"
            className={cn(button({ size: 'sm' }), 'bg-site-lime')}
            onClick={() => {
              returnsFocus.current = false;
              dialogRef.current?.close();
              requestAnimationFrame(() => {
                // The demo section holds a form per view; the hidden one has no layout box.
                const field = [...document.querySelectorAll<HTMLElement>('#demo input')].find(
                  (input) => input.offsetParent !== null,
                );
                field?.focus({ preventScroll: true });
              });
            }}
          >
            {comingSoon.bookDemo}
          </a>
        </div>
      </dialog>
    </>
  );
}
