'use client';

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';

import { loadTurnstile, type TurnstileApi } from './turnstile-loader';

import type { TurnstileAction } from '@quad/contracts';

/** The action the API checks the token against (D57), so a token for another form fails. */
const ACTION: TurnstileAction = 'demo-request';
/** How long a submit waits for a token: an interactive challenge needs the visitor's time. */
const TOKEN_WAIT_MS = 60_000;

/** What the form asks of the widget. */
export interface TurnstileHandle {
  /** The current token, or the next one; rejects when Turnstile cannot give one. */
  token: () => Promise<string>;
  /** Drops the token (each is single-use) and asks Cloudflare for a fresh one. */
  reset: () => void;
}

/**
 * The widget's site key, or, in a local build without one (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`
 * unset), the dummy token the API's local verifier accepts, so the e2e stack needs no network.
 */
export type TurnstileSetup = { siteKey: string } | { dummyToken: string };

/** The page's theme (`data-theme`), or the device's when the visitor has not picked one. */
function pageTheme(): 'light' | 'dark' | 'auto' {
  const theme = document.documentElement.dataset.theme;
  return theme === 'light' || theme === 'dark' ? theme : 'auto';
}

interface Waiter {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

/** One Turnstile widget in `container`: loads the script on `start`, then keeps its token. */
function turnstileWidget(siteKey: string, container: HTMLElement) {
  let token: string | null = null;
  let failure: Error | null = null;
  let api: TurnstileApi | null = null;
  let widgetId: string | null = null;
  let started = false;
  let removed = false;
  const waiters = new Set<Waiter>();

  const settle = () => {
    for (const waiter of waiters) {
      if (token !== null) waiter.resolve(token);
      else if (failure !== null) waiter.reject(failure);
      else return;
      waiters.delete(waiter);
    }
  };
  const fail = (error: Error) => {
    token = null;
    failure = error;
    settle();
  };

  const start = () => {
    if (started || removed) return;
    started = true;
    loadTurnstile().then(
      (loaded) => {
        if (removed) return;
        api = loaded;
        widgetId =
          loaded.render(container, {
            sitekey: siteKey,
            action: ACTION,
            appearance: 'interaction-only',
            theme: pageTheme(),
            'response-field': false,
            callback: (next) => {
              token = next;
              failure = null;
              settle();
            },
            'error-callback': (code) => {
              fail(new Error(`Turnstile reported error ${code}.`));
            },
            'expired-callback': () => {
              token = null;
            },
          }) ?? null;
      },
      (error: unknown) => {
        // The next reset tries the script again.
        started = false;
        fail(error instanceof Error ? error : new Error('Turnstile could not load.'));
      },
    );
  };

  return {
    start,
    token(): Promise<string> {
      if (token !== null) return Promise.resolve(token);
      if (failure !== null) return Promise.reject(failure);
      start();
      return new Promise<string>((resolve, reject) => {
        const waiter = { resolve, reject };
        waiters.add(waiter);
        setTimeout(() => {
          if (waiters.delete(waiter)) reject(new Error('Turnstile gave no token in time.'));
        }, TOKEN_WAIT_MS);
      });
    },
    reset() {
      token = null;
      failure = null;
      if (api !== null && widgetId !== null) api.reset(widgetId);
    },
    remove() {
      removed = true;
      if (api !== null && widgetId !== null) api.remove(widgetId);
      fail(new Error('The Turnstile widget was removed.'));
    },
  };
}

/**
 * The demo form's Turnstile check (spec 19 "Demo requests", D57). Nothing loads until `active`
 * (the visitor's first focus in the form) or until a token is asked for; then Cloudflare's script
 * renders an invisible widget (`interaction-only`, shown only when Cloudflare needs the visitor)
 * in the page's theme. Without a site key it renders nothing and hands over the dummy token.
 */
export function TurnstileField({
  setup,
  active,
  ref,
}: {
  setup: TurnstileSetup;
  active: boolean;
  ref?: Ref<TurnstileHandle>;
}) {
  const siteKey = 'siteKey' in setup ? setup.siteKey : null;
  const dummyToken = 'dummyToken' in setup ? setup.dummyToken : null;
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<ReturnType<typeof turnstileWidget> | null>(null);
  const isActive = useRef(active);
  isActive.current = active;

  useImperativeHandle(
    ref,
    () =>
      dummyToken !== null
        ? { token: () => Promise.resolve(dummyToken), reset: () => undefined }
        : {
            token: () =>
              widget.current?.token() ?? Promise.reject(new Error('Turnstile is not on the page.')),
            reset: () => widget.current?.reset(),
          },
    [dummyToken],
  );

  useEffect(() => {
    if (siteKey === null || container.current === null) return undefined;
    const current = turnstileWidget(siteKey, container.current);
    widget.current = current;
    if (isActive.current) current.start();
    return () => {
      current.remove();
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (active) widget.current?.start();
  }, [active]);

  if (siteKey === null) return null;
  return <div ref={container} className="empty:hidden" />;
}
