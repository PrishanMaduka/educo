import { SiteArtDefs } from './_art/Face';
import { viewBootstrapScript } from './_lib/view';
import { LiveSignInHost, SignedInHint } from './_live';

import type { ReactNode } from 'react';

import { SLOT_MARKER, splitAround, t } from '@/i18n';
import { publicEnv } from '@/lib/public-env';

/** "Open {school}" around the school's name, which the browser fills in from `GET /me` (D57). */
function openSchoolLabel(): { before: string; after: string } {
  const [before, after] = splitAround(t('public.openSchool', { school: SLOT_MARKER }), SLOT_MARKER);
  return { before, after };
}

/**
 * The public site (spec 19 "Where it lives"): statically rendered, no signed-in code. Its typeface,
 * Bricolage Grotesque, comes from the root layout (`--font-bricolage`, shared with the apps). The
 * script sets the visitor's view (school or parent) on <html> before the page paints. On the live
 * site the sign-in dialog's host waits for a Sign in or `/#signin`, and the signed-in hint turns
 * each Sign in into Open {school} for a signed-in visitor (D57); before launch neither is there,
 * and the pre-launch export does not even compile them.
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
      {!publicEnv.NEXT_PUBLIC_QUAD_PRELAUNCH && (
        <>
          <LiveSignInHost />
          <SignedInHint openSchool={openSchoolLabel()} />
        </>
      )}
    </div>
  );
}
