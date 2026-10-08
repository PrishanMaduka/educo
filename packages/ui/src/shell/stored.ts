'use client';

import { useSyncExternalStore } from 'react';

/*
 * Per-browser preferences in localStorage (theme, collapsed side bar). Storage can be missing or blocked
 * (private windows, previews), so every read and write is guarded and the default is used instead.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is blocked: the choice still applies until the page is reloaded.
  }
  for (const listener of listeners) listener();
}

/** The stored value, or null on the server and during hydration (so server and first client render match). */
export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
}
