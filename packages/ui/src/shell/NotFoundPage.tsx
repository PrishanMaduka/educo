import { QuadMark } from '@quad/tokens/logo';

import { buttonVariants } from '../components/Button';

import type { ShellLinkComponent } from './types';

export interface NotFoundPageProps {
  title: string;
  body: string;
  /** "Go to Home". */
  actionLabel: string;
  /** Where Home is: `/app` in the staff portal, `/` in the console. */
  homeHref: string;
  linkComponent?: ShellLinkComponent;
}

/** The 404 page for the staff portal and the console: a short card that says what happened and leads home. */
export function NotFoundPage({
  title,
  body,
  actionLabel,
  homeHref,
  linkComponent,
}: NotFoundPageProps) {
  const Link = linkComponent ?? 'a';
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-4">
      <div className="flex w-full max-w-[480px] flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-10 text-center shadow-card">
        <QuadMark size={48} aria-hidden="true" />
        <h1 className="m-0 mt-2 font-display text-[26px] leading-[1.2] font-extrabold tracking-[-0.02em] text-balance text-ink">
          {title}
        </h1>
        <p className="m-0 text-[15px] text-ink-2">{body}</p>
        <Link
          href={homeHref}
          className={buttonVariants({ className: 'mt-2 h-[38px] rounded-full px-4' })}
        >
          {actionLabel}
        </Link>
      </div>
    </main>
  );
}
