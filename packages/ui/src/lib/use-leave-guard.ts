'use client';

import { useEffect } from 'react';

/** A plain left click on a link to another page of this site, opening in this tab. */
function leavingLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(link instanceof HTMLAnchorElement)) return null;
  if ((link.target !== '' && link.target !== '_self') || link.hasAttribute('download')) return null;
  const to = new URL(link.href, window.location.href);
  const here = new URL(window.location.href);
  if (to.origin !== here.origin) return null;
  // A link to a part of this page (`#matrix`) does not leave it.
  if (to.pathname === here.pathname && to.search === here.search && to.hash !== '') return null;
  return link;
}

/**
 * While `active` (unsaved changes), asks before the page is left: a link in the app (the sidebar,
 * a Cancel or Back link) asks `message` with the browser's confirm and stays on "Cancel", and a
 * reload or a closed tab gets the browser's own "Leave site?" (`beforeunload`).
 */
export function useLeaveGuard(active: boolean, message: string): void {
  useEffect(() => {
    if (!active) return undefined;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older Safari and webviews show the prompt only when returnValue is set.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      event.returnValue = '';
    };
    // Capture, so this runs before the router's own click handler on the link.
    const onClick = (event: MouseEvent) => {
      if (leavingLink(event) === null) return;
      if (window.confirm(message)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, message]);
}
