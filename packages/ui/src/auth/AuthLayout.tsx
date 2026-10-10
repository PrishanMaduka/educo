import { QuadLogo } from '@quad/tokens/logo';

import type { ReactNode } from 'react';

export interface AuthArtProps {
  /** The big line, with its last words on a lime pill ("Everyone signs in at" + "One address."). */
  titleStart: string;
  titleHighlight: string;
  body: string;
  /** A line beside the logo ("Platform console"); none on the staff portal. */
  product?: string;
  /** Up to three figures under the line; none when the app has nothing true to show yet. */
  stats?: readonly { readonly value: string; readonly label: string }[];
}

/**
 * The Quad-branded panel beside a sign-in card (`design/admin.html` and `design/platform.html`
 * `.auth-art`): before sign-in nobody knows the school, so it wears Quad's navy and lime.
 * Decorative copy, so its big line is a paragraph: the card's title is the page's `h1`. The
 * radial gradients are built from tokens (D32 Sign-in pages).
 */
export function AuthArt({ titleStart, titleHighlight, body, product, stats = [] }: AuthArtProps) {
  return (
    <div className="relative isolate flex flex-col justify-between gap-6 overflow-hidden bg-site-navy p-11 text-site-on-navy max-[860px]:p-6">
      <div
        aria-hidden="true"
        className="absolute -right-[180px] -bottom-[200px] -z-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-site-lime)_30%,transparent),transparent)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--color-site-on-navy)_1px,transparent_1px)] bg-size-[22px_22px] opacity-10 [mask-image:linear-gradient(180deg,transparent,var(--color-ink)_45%,transparent)]"
      />
      <div className="flex items-center gap-3">
        <QuadLogo variant="white" size={34} />
        {product ? (
          <span className="rounded-pill bg-site-lime px-2.5 py-0.5 text-[11px] font-extrabold tracking-[0.08em] text-site-navy uppercase">
            {product}
          </span>
        ) : null}
      </div>
      <div className="max-w-[560px]">
        <p className="m-0 mb-3.5 text-[clamp(34px,4vw,52px)] leading-[1.02] font-extrabold tracking-[-0.04em] max-[860px]:text-[32px]">
          {titleStart}{' '}
          <span className="inline-block -rotate-2 rounded-pill bg-site-lime px-[0.24em] text-site-navy">
            {titleHighlight}
          </span>
        </p>
        <p className="m-0 text-base text-site-on-navy-2">{body}</p>
      </div>
      {stats.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0 max-[860px]:hidden">
          {stats.map((stat) => (
            <li
              key={stat.label}
              className="min-w-28 rounded-[18px] border border-site-navy-line bg-site-navy-2 px-4 py-3"
            >
              <b className="block text-[22px] font-extrabold text-site-lime">{stat.value}</b>
              <span className="text-xs text-site-on-navy-2">{stat.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}

export interface AuthLayoutProps {
  art: ReactNode;
  /** The line under the card ("Every sign-in … is recorded in the audit log."). */
  foot: string;
  children: ReactNode;
}

/** A sign-in page: the art panel, then the card on the canvas (one column under 860 px). */
export function AuthLayout({ art, foot, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1.15fr)_minmax(360px,1fr)] bg-surface max-[860px]:grid-cols-1 max-[860px]:grid-rows-[auto_1fr]">
      {art}
      <main className="flex min-w-0 flex-col items-center justify-center gap-[22px] bg-canvas px-6 py-10 max-[860px]:justify-start max-[860px]:px-4 max-[860px]:pt-7">
        {children}
        <p className="m-0 text-center text-xs text-ink-2">{foot}</p>
      </main>
    </div>
  );
}
