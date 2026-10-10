'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useOpenSchool } from './open-school';

/** The address that opens the sign-in dialog on the landing page (`/#signin`, D57). */
const SIGN_IN_HASH = '#signin';

// The dialog, with the M1 sign-in flow, its strings and the API client, is its own chunk: it
// loads on the first Sign in or `#signin`, so it is not part of the landing page's first load.
const loadDialog = () => import('./SignInDialog');
const SignInDialog = dynamic(() => loadDialog().then((m) => m.SignInDialog), { ssr: false });

/** Starts loading the dialog when a pointer reaches a Sign in, so it is usually ready by the click. */
const preload = () => {
  void loadDialog();
};

type Open = (opener: HTMLElement | null) => void;

/** The one host on the page registers here; each Sign in button asks it to open. */
let openHost: Open | null = null;

/**
 * A Sign in entry on the live site (spec 19 "Sign-in"): a button that opens the sign-in dialog.
 * Without a dialog host on the page it goes to the sign-in page instead. For a signed-in visitor
 * (`SignedInHint`) it is a link "Open {school}" to `/app`.
 */
export function LiveSignIn({ label, className }: { label: string; className?: string }): ReactNode {
  const openSchool = useOpenSchool();
  if (openSchool !== null) {
    return (
      <a href="/app" data-open-school="" className={className}>
        {openSchool}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      data-signin=""
      className={className}
      onPointerEnter={preload}
      onPointerDown={preload}
      onClick={(event) => {
        if (openHost) openHost(event.currentTarget);
        else window.location.assign('/sign-in');
      }}
    >
      {label}
    </button>
  );
}

/** The first Sign in a visitor can see (the top bar's on a wide screen), for `#signin`. */
function firstVisibleSignIn(): HTMLElement | null {
  const entries = [...document.querySelectorAll<HTMLElement>('[data-signin]')];
  return entries.find((entry) => entry.offsetParent !== null) ?? entries[0] ?? null;
}

/**
 * Holds the public pages' sign-in dialog (one per page, from the public layout). It renders
 * nothing until someone asks to sign in: a Sign in button, `/#signin` on load, or a change of
 * address to `#signin`. Closing returns focus to the opener and takes `#signin` off the address.
 */
export function LiveSignInHost({ onOpen }: { onOpen?: (path: string) => void }): ReactNode {
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  // Each opening starts the flow again at the email step.
  const [session, setSession] = useState(0);
  const opener = useRef<HTMLElement | null>(null);

  const show = useCallback<Open>((from) => {
    opener.current = from;
    setLoaded(true);
    setSession((n) => n + 1);
    setOpen(true);
  }, []);

  useEffect(() => {
    openHost = show;
    const fromHash = () => {
      if (window.location.hash === SIGN_IN_HASH) show(null);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => {
      if (openHost === show) openHost = null;
      window.removeEventListener('hashchange', fromHash);
    };
  }, [show]);

  const closed = useCallback(() => {
    setOpen(false);
    if (window.location.hash === SIGN_IN_HASH) {
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, '', `${pathname}${search}`);
    }
    const target = opener.current ?? firstVisibleSignIn();
    opener.current = null;
    target?.focus();
  }, []);

  if (!loaded) return null;
  return <SignInDialog key={session} open={open} onClosed={closed} onOpen={onOpen} />;
}
