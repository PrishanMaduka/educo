'use client';

import { cookieValue } from '@quad/client';
import { LAST_SCHOOL_COOKIE } from '@quad/contracts/cookie-names';
import { QuadMark } from '@quad/tokens/logo';
import { cn } from '@quad/ui';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';

import { SignInFlow } from '../../(auth)/sign-in/_components/SignInFlow';
import { AppBadges } from '../_components/AppBadges';
import { focusRing } from '../_components/styles';
import { SITE_ORIGIN } from '../_lib/site';
import { track } from '../_lib/track';

import { Providers } from '@/components/Providers';
import { t } from '@/i18n';
import { lastSchoolFrom } from '@/lib/session';

export interface SignInDialogProps {
  /** Open as a modal while true. */
  open: boolean;
  /** After it closes (Escape, the close button or the backdrop). */
  onClosed: () => void;
  /** Opens the portal; a full page load by default (the flow's own). */
  onOpen?: (path: string) => void;
}

/** True when a click on the dialog element landed outside its box, on the backdrop. */
function onBackdrop(dialog: HTMLDialogElement, event: MouseEvent): boolean {
  const box = dialog.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return false;
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab inside the dialog: a modal `<dialog>` makes the page inert, but Tab from its last
 * control still leaves for the browser's own toolbar. From the last control Tab goes to the first,
 * and Shift+Tab from the first goes to the last.
 */
function keepTabInside(dialog: HTMLDialogElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  // Steps render only their own controls, so a hidden one is only ever inside `[hidden]`.
  const controls = [...dialog.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (control) => control.tabIndex >= 0 && control.closest('[hidden]') === null,
  );
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Sign in from the landing page (spec 19 "Sign-in"; D57; the prototype's `dialog.si`): the M1
 * identifier-first flow, unchanged, inside a site-palette sheet (OQ-T1). The flow keeps the app
 * tokens; the sheet, its close button and the parents line use the `site-*` ones.
 */
export function SignInDialog({ open, onClosed, onOpen }: SignInDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // `quad_last_school` is readable by the page (spec 05): "Welcome back to {school}" only.
  const [lastSchool] = useState(() =>
    lastSchoolFrom(cookieValue(document.cookie, [LAST_SCHOOL_COOKIE]) ?? undefined),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The browser focuses the first control, the close button; the email field comes first, as
      // on /sign-in (the step's own autoFocus ran while the dialog was still closed).
      dialog.querySelector<HTMLElement>('input')?.focus();
      track('sign_in_opened');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    dialog.addEventListener('close', onClosed);
    return () => {
      dialog.removeEventListener('close', onClosed);
    };
  }, [onClosed]);

  return (
    // The dialog's own Escape and close button work from the keyboard; a click on the backdrop
    // is the pointer's extra way out.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- see above
    <dialog
      ref={dialogRef}
      data-signin-dialog=""
      // The flow's current step title (the M1 `AuthCard` heading).
      aria-labelledby="auth-title"
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(480px,calc(100%-32px))] overflow-y-auto rounded-[28px] border-0 bg-site-sheet-bg p-7 text-left font-site text-site-sheet-ink shadow-[0_40px_80px_-30px_var(--quad-site-card-shadow)] backdrop:bg-site-backdrop backdrop:backdrop-blur-[3px] max-[420px]:p-4"
      onKeyDown={(event) => {
        if (dialogRef.current) keepTabInside(dialogRef.current, event);
      }}
      onClick={(event) => {
        const dialog = dialogRef.current;
        if (dialog && event.target === dialog && onBackdrop(dialog, event)) dialog.close();
      }}
    >
      <form method="dialog" className="absolute top-3.5 right-3.5 m-0">
        <button
          type="submit"
          aria-label={t('public.signInDialog.close')}
          className={cn(
            'grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-site-sheet-ink-2 hover:bg-site-sheet-2',
            focusRing,
          )}
        >
          <X aria-hidden="true" strokeWidth={2.2} className="size-5" />
        </button>
      </form>
      <p className="m-0 mb-[18px] flex items-center gap-2 text-[13px] font-bold text-site-sheet-ink-2">
        <QuadMark size={26} aria-hidden="true" />
        <span>{new URL(SITE_ORIGIN).host}</span>
      </p>
      <Providers>
        <SignInFlow
          lastSchool={lastSchool}
          next="/app"
          onOpen={onOpen}
          emailParents={
            <div className="flex flex-col gap-2.5">
              <p className="m-0 text-[13px] font-bold text-ink-2">
                {t('public.signInDialog.parents')}
              </p>
              <AppBadges tone="demo" />
            </div>
          }
        />
      </Providers>
    </dialog>
  );
}
