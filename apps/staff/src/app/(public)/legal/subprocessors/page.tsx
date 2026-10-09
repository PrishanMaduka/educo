import { subprocessorsPage } from '../../../../../content/legal/subprocessors';
import { ArticlePage } from '../../_components/ArticlePage';
import { publicPageMetadata, publicViewport } from '../../_lib/page-meta';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = publicPageMetadata({
  path: subprocessorsPage.path,
  title: subprocessorsPage.metaTitle,
  description: subprocessorsPage.description,
});

export const viewport: Viewport = publicViewport;

/** The sub-processor list (spec 19, D21, D41). */
export default function SubprocessorsPage() {
  return <ArticlePage content={subprocessorsPage} />;
}
