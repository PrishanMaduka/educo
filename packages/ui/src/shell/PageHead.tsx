import type { ReactNode } from 'react';

export interface PageHeadProps {
  /** Small uppercase crumb above the title. */
  crumb?: string;
  title: string;
  /** One-line description: the page's story in a sentence. */
  description?: ReactNode;
  /** Buttons on the right; they wrap under the title on phones. */
  actions?: ReactNode;
}

/** Spec 03 "Page head": crumb, page title, optional one-line description and actions. */
export function PageHead({ crumb, title, description, actions }: PageHeadProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-[220px] flex-1">
        {crumb ? (
          <p className="m-0 mb-1 text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">
            {crumb}
          </p>
        ) : null}
        <h1 className="m-0 font-display text-[30px] leading-[1.15] font-extrabold tracking-[-0.02em] text-balance text-ink">
          {title}
        </h1>
        {description ? (
          <p className="m-0 mt-1.5 max-w-[70ch] text-[15px] leading-normal text-ink-2">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
