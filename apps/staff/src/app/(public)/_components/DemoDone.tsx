import { cn } from '@quad/ui';

import { focusRing, inlineLink } from './styles';

import type { ReactNode, Ref } from 'react';

/**
 * What replaces a demo form once the request is on its way (spec 19): "Your email app should
 * open…" with the address as a link (pre-launch, D30), or the thank-you (D57). `role="status"`, so
 * a screen reader announces it; the form focuses the title.
 */
export function DemoDone({
  ref,
  cheer,
  title,
  email,
  again,
  onAgain,
}: {
  ref: Ref<HTMLHeadingElement>;
  /** Maya's face, cheering. */
  cheer: ReactNode;
  title: string;
  /** "If it doesn't open, email us at {address}", around the link to the request's email. */
  email: { href: string; to: string; before: string; after: string } | null;
  /** **Send another**. */
  again: string;
  onAgain: () => void;
}) {
  return (
    <div role="status" className="flex min-h-[320px] flex-col items-start justify-center gap-3.5">
      <div aria-hidden="true" className="size-24 motion-safe:animate-bob [animation-duration:2s]">
        {cheer}
      </div>
      <h3
        ref={ref}
        tabIndex={-1}
        className="m-0 text-[30px] font-extrabold tracking-[-.03em] outline-none"
      >
        {title}
      </h3>
      {email && (
        <p className="m-0 text-base text-site-on-navy-2">
          {email.before}
          <a href={email.href} className={inlineLink}>
            {email.to}
          </a>
          {email.after}
        </p>
      )}
      <button
        type="button"
        onClick={onAgain}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-solid border-site-navy-border bg-transparent px-4 py-2.5 font-semibold text-site-on-navy',
          focusRing,
        )}
      >
        {again}
      </button>
    </div>
  );
}
