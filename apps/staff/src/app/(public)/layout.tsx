import { cn } from '@quad/ui';
import { Fraunces } from 'next/font/google';

import { WatercolourFilters } from './_illustrations/Painting';

import type { ReactNode } from 'react';

// The serif accent (spec 19 tokens: Fraunces italic 500/600), self-hosted at build, public pages only.
// The variable font with its optical-size axis, as the prototype loads it: large headings get the
// high-contrast display cut.
const fraunces = Fraunces({
  subsets: ['latin'],
  style: 'italic',
  axes: ['opsz'],
  variable: '--font-fraunces',
  display: 'swap',
});

/**
 * The public site (spec 19 "Where it lives"): statically rendered, no signed-in code. The
 * `data-site` scope switches the colour tokens to palette B (Sky blue) and Soft charcoal.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-site="public"
      className={cn(
        fraunces.variable,
        'min-h-dvh overflow-x-clip bg-canvas text-base leading-[1.6] text-ink',
      )}
    >
      <WatercolourFilters />
      {children}
    </div>
  );
}
