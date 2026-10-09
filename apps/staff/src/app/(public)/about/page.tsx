import { aboutPage } from '../../../../content/about';
import { ArticlePage } from '../_components/ArticlePage';
import { publicPageMetadata, publicViewport } from '../_lib/page-meta';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = publicPageMetadata({
  path: aboutPage.path,
  title: aboutPage.metaTitle,
  description: aboutPage.description,
});

export const viewport: Viewport = publicViewport;

/** About Quad (D41). */
export default function AboutPage() {
  return <ArticlePage content={aboutPage} />;
}
