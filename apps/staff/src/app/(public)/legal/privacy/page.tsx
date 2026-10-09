import { privacyPage } from '../../../../../content/legal/privacy';
import { ArticlePage } from '../../_components/ArticlePage';
import { publicPageMetadata, publicViewport } from '../../_lib/page-meta';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = publicPageMetadata({
  path: privacyPage.path,
  title: privacyPage.metaTitle,
  description: privacyPage.description,
});

export const viewport: Viewport = publicViewport;

/** The privacy policy (spec 19 legal pages, D41). */
export default function PrivacyPage() {
  return <ArticlePage content={privacyPage} />;
}
