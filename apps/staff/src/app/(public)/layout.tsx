import { SiteArtDefs } from './_art/Face';
import { viewBootstrapScript } from './_lib/view';

import type { ReactNode } from 'react';

/**
 * The public site (spec 19 "Where it lives"): statically rendered, no signed-in code. Its typeface,
 * Bricolage Grotesque, comes from the root layout (`--font-bricolage`, shared with the apps). The
 * script sets the visitor's view (school or parent) on <html> before the page paints.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-site="public"
      className="min-h-dvh overflow-x-clip bg-site-hero-bg font-site text-base leading-[1.55] text-site-on-navy antialiased"
    >
      <script dangerouslySetInnerHTML={{ __html: viewBootstrapScript }} />
      <SiteArtDefs />
      {children}
    </div>
  );
}
