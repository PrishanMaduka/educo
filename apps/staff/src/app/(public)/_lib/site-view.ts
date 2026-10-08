'use client';

import { useSyncExternalStore } from 'react';

import { VIEW_PARAM, VIEW_STORAGE_KEY, viewUrl, type SiteView } from './view';

/** The view the page shows, from `data-view` on <html> (set before paint by the layout). */
function readView(): SiteView {
  return document.documentElement.dataset.view === 'parent' ? 'parent' : 'school';
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-view'] });
  return () => { observer.disconnect(); };
}

/** The current view; "school" on the server and during hydration. */
export function useSiteView(): SiteView {
  return useSyncExternalStore(subscribe, readView, () => 'school');
}

/**
 * Switches the page to a view: the CSS shows that view's content, the address says `?view=parent`
 * (so it can be shared and reloads the same), and the browser remembers it for the next visit.
 */
export function setSiteView(view: SiteView): void {
  document.documentElement.dataset.view = view;
  window.history.replaceState(window.history.state, '', viewUrl(window.location.href, view));
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Storage is blocked: the address still carries the view.
  }
}

export { VIEW_PARAM };
