import { publicSite } from '@quad/tokens';

import { SITE_ORIGIN } from './site';

import type { Metadata, Viewport } from 'next';

import { t } from '@/i18n';

/** The browser chrome colour of every public page: the hero navy, light and dark (spec 19). */
export const publicViewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: publicSite.light['hero-bg'] },
    { media: '(prefers-color-scheme: dark)', color: publicSite.dark['hero-bg'] },
  ],
};

/**
 * Title, description, canonical URL and social cards for a public page (spec 19 SEO). `path` is
 * the page's path without a trailing slash, e.g. `/legal/privacy` (`/` for the landing page).
 */
export function publicPageMetadata({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}): Metadata {
  const url = `${SITE_ORIGIN}${path}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, siteName: t('public.wordmark'), title, description },
    twitter: { card: 'summary', title, description },
  };
}
