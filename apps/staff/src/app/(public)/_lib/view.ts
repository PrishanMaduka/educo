/*
 * The visitor's view of the public site (spec 19): "I run a school" (the default) or "I'm a
 * parent". It is `data-view` on <html>, `?view=parent` in the address, and remembered in the
 * browser.
 */

import { VIEW_STORAGE_KEY } from '@quad/contracts/cookie-names';

export type SiteView = 'school' | 'parent';

export const VIEW_PARAM = 'view';
/** The remembered view in `localStorage`, named in the cookie registry (D57). */
export { VIEW_STORAGE_KEY };

/** The address for a view: `?view=parent` for parents; schools, the default, drop the parameter. */
export function viewUrl(href: string, view: SiteView): string {
  const url = new URL(href);
  if (view === 'parent') url.searchParams.set(VIEW_PARAM, 'parent');
  else url.searchParams.delete(VIEW_PARAM);
  return url.toString();
}

/** The view to open with: the address first, then the remembered choice, else schools. */
export function initialView(param: string | null, remembered: string | null): SiteView {
  if (param === 'parent' || param === 'school') return param;
  return remembered === 'parent' ? 'parent' : 'school';
}

/**
 * Runs in the page before paint (the (public) layout), so the right view shows at once. It
 * mirrors `initialView`.
 */
export const viewBootstrapScript = `try{var r=document.documentElement,p=new URLSearchParams(location.search).get('${VIEW_PARAM}'),s=null;try{s=localStorage.getItem('${VIEW_STORAGE_KEY}')}catch(e){}r.setAttribute('data-view',p==='parent'||p==='school'?p:s==='parent'?'parent':'school')}catch(e){}`;
