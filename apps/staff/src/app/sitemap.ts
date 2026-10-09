import { PUBLIC_PATHS } from './(public)/_lib/public-pages';
import { SITE_ORIGIN } from './(public)/_lib/site';

import type { MetadataRoute } from 'next';

// Built once at build time, so the static export can write it as a file.
export const dynamic = 'force-static';

/** `/sitemap.xml` (spec 19 SEO): the public pages on the canonical origin. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({ url: `${SITE_ORIGIN}${path}` }));
}
