import { aboutPage } from '../../../../content/about';
import { cookiesPage } from '../../../../content/legal/cookies';
import { dpaPage } from '../../../../content/legal/dpa';
import { privacyPage } from '../../../../content/legal/privacy';
import { termsPage } from '../../../../content/legal/terms';
import { securityPage } from '../../../../content/security';

import type { ArticleContent } from './article';

/** The About, Security & trust and legal pages (D41), in footer order. */
export const ARTICLE_PAGES: readonly ArticleContent[] = [
  aboutPage,
  securityPage,
  privacyPage,
  termsPage,
  dpaPage,
  cookiesPage,
];

/** Every public path for the sitemap (spec 19 SEO): the landing page, then the pages above. */
export const PUBLIC_PATHS: readonly string[] = ['/', ...ARTICLE_PAGES.map((page) => page.path)];
