import { termsPage } from '../../../../../content/legal/terms';
import { ArticlePage } from '../../_components/ArticlePage';
import { publicPageMetadata, publicViewport } from '../../_lib/page-meta';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = publicPageMetadata({
  path: termsPage.path,
  title: termsPage.metaTitle,
  description: termsPage.description,
});

export const viewport: Viewport = publicViewport;

/** The terms of service (spec 19 legal pages, D41). */
export default function TermsPage() {
  return <ArticlePage content={termsPage} />;
}
