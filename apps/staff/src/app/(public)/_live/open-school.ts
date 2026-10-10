import { useSyncExternalStore } from 'react';

/*
 * Open {school} (spec 19 "Sign-in", D57): what every Sign in entry on the page shows instead when
 * the visitor is signed in. `SignedInHint` sets it from `GET /me`; `LiveSignIn` reads it. A module
 * store, like the dialog host's registration, so the static page needs no client wrapper.
 */

/** "Open Greenfield International School", or null while the visitor is not known to be signed in. */
let openSchoolLabel: string | null = null;
const listeners = new Set<() => void>();

/** Sets, or with null clears, the Open {school} label for every Sign in entry on the page. */
export function setOpenSchool(label: string | null): void {
  if (label === openSchoolLabel) return;
  openSchoolLabel = label;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The Open {school} label, or null. Null on the server and in the first render, so the static
 * HTML and hydration always show Sign in.
 */
export function useOpenSchool(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => openSchoolLabel,
    () => null,
  );
}
