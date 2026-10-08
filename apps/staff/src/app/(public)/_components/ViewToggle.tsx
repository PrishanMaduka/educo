'use client';

import { cn } from '@quad/ui';

import { setSiteView, useSiteView } from '../_lib/site-view';

import { focusRing } from './styles';

import type { SiteView } from '../_lib/view';

/**
 * The pressed look comes from `data-view` on <html>, not from React state: the layout's script
 * sets it before the first paint, so the right button looks pressed from the start. React only
 * learns the view after hydration, and styling from its state made the buttons swap colours then,
 * mid-transition and below 4.5:1 for a moment.
 */
const PRESSED_LOOK: Record<SiteView, string> = {
  school:
    'bg-site-paper text-site-on-vivid view-parent:bg-transparent view-parent:text-site-on-navy-2',
  parent:
    'bg-transparent text-site-on-navy-2 view-parent:bg-site-paper view-parent:text-site-on-vivid',
};

/**
 * "I run a school / I'm a parent" (spec 19 top bar): switches the page's copy, sections and accent,
 * and remembers the choice with `?view=parent`.
 */
export function ViewToggle({
  label,
  labels,
  className,
}: {
  label: string;
  labels: Record<SiteView, string>;
  className?: string;
}) {
  const view = useSiteView();
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex rounded-[14px] bg-site-navy-2 p-1', className)}
    >
      {(['school', 'parent'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          onClick={() => {
            setSiteView(option);
          }}
          className={cn(
            'cursor-pointer rounded-[10px] border-0 px-3.5 py-2 text-sm font-semibold transition-colors duration-[250ms] max-[760px]:flex-1 motion-reduce:transition-none',
            PRESSED_LOOK[option],
            focusRing,
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
