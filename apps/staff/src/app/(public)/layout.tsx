import { cn } from '@quad/ui';
import localFont from 'next/font/local';

import { SiteArtDefs } from './_art/Face';
import { viewBootstrapScript } from './_lib/view';

import type { ReactNode } from 'react';

// The public site's typeface (spec 19): Bricolage Grotesque (OFL, _fonts/OFL.txt), variable in
// weight and optical size, public pages only. The file is Google Fonts' latin build for Linux and
// Windows: next/font/google downloads the macOS build, which has no hinting program and renders
// about 3 % wider there than the prototype.
const bricolage = localFont({
  src: './_fonts/bricolage-grotesque-latin.woff2',
  weight: '400 800',
  style: 'normal',
  variable: '--font-bricolage',
  display: 'swap',
});

/**
 * The public site (spec 19 "Where it lives"): statically rendered, no signed-in code. The script
 * sets the visitor's view (school or parent) on <html> before the page paints.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-site="public"
      className={cn(
        bricolage.variable,
        'min-h-dvh overflow-x-clip bg-site-hero-bg font-site text-base leading-[1.55] text-site-on-navy antialiased',
      )}
    >
      <script dangerouslySetInnerHTML={{ __html: viewBootstrapScript }} />
      <SiteArtDefs />
      {children}
    </div>
  );
}
