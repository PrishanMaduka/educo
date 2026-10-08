'use client';

import { cn } from '@quad/ui';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { button, focusRing, linkButton } from './styles';

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
  prelaunch,
  comingSoon,
}: {
  label: string;
  look: 'nav' | 'link';
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

  const className =
    look === 'nav' ? button({ variant: 'ghost', size: 'nav' }) : cn(linkButton, 'text-[14.5px]');

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
        className="m-auto w-[min(440px,calc(100%-32px))] rounded-[24px] border border-line bg-surface p-7 text-left text-ink shadow-lg backdrop:bg-wc-shade/60 backdrop:backdrop-blur-[3px]"
      >
        <form method="dialog" className="absolute top-3.5 right-3.5 m-0">
          <button
            type="submit"
            aria-label={comingSoon.close}
            className={cn(
              'grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-3 hover:bg-surface-2',
              focusRing,
            )}
          >
            <X aria-hidden="true" strokeWidth={2.2} className="size-5" />
          </button>
        </form>
        <p className="m-0 inline-block rounded-pill bg-coral-soft px-2.5 py-[3px] text-[11.5px] font-extrabold tracking-[.1em] text-coral-ink uppercase">
          {comingSoon.badge}
        </p>
        <h2
          id={titleId}
          className="m-0 mt-3.5 pr-10 text-[26px] leading-[1.15] font-black tracking-[-.02em] text-balance"
        >
          {comingSoon.title}
        </h2>
        <p id={bodyId} className="m-0 mt-2 text-[15px] leading-[1.55] text-ink-2">
          {comingSoon.body}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="#demo"
            className={button({ size: 'lg' })}
            onClick={() => {
              returnsFocus.current = false;
              dialogRef.current?.close();
              requestAnimationFrame(() =>
                document.querySelector<HTMLElement>('#demo input')?.focus({ preventScroll: true }),
              );
            }}
          >
            {comingSoon.bookDemo}
          </a>
        </div>
      </dialog>
    </>
  );
}
