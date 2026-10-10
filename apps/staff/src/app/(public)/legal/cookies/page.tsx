import { cookiesPage } from '../../../../../content/legal/cookies';
import { ArticlePage } from '../../_components/ArticlePage';
import { publicPageMetadata, publicViewport } from '../../_lib/page-meta';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = publicPageMetadata({
  path: cookiesPage.path,
  title: cookiesPage.metaTitle,
  description: cookiesPage.description,
});

export const viewport: Viewport = publicViewport;

/** The cookie notice, rendered from the cookie registry (spec 19 legal pages, D57). */
export default function CookiesPage() {
  return <ArticlePage content={cookiesPage} />;
}
