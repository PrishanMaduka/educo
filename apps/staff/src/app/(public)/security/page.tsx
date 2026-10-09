import { securityPage } from '../../../../content/security';
import { ArticlePage } from '../_components/ArticlePage';
import { publicPageMetadata, publicViewport } from '../_lib/page-meta';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = publicPageMetadata({
  path: securityPage.path,
  title: securityPage.metaTitle,
  description: securityPage.description,
});

export const viewport: Viewport = publicViewport;

/** Security & trust (D41). */
export default function SecurityPage() {
  return <ArticlePage content={securityPage} />;
}
