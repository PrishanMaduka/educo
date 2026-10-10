import { dpaPage } from '../../../../../content/legal/dpa';
import { ArticlePage } from '../../_components/ArticlePage';
import { publicPageMetadata, publicViewport } from '../../_lib/page-meta';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = publicPageMetadata({
  path: dpaPage.path,
  title: dpaPage.metaTitle,
  description: dpaPage.description,
});

export const viewport: Viewport = publicViewport;

/** The data processing agreement (spec 19 legal pages, D57). */
export default function DpaPage() {
  return <ArticlePage content={dpaPage} />;
}
