import { cva } from 'class-variance-authority';

/*
 * Class strings shared by the public landing page (spec 19, design/landing.html). `site-*` token
 * utilities only.
 */

/** The 1320 px column. */
export const wrap = 'mx-auto w-full max-w-[1320px] px-[clamp(16px,4vw,56px)]';

/** Content for one view only ("I run a school" / "I'm a parent"); the other view hides it. */
export const onlySchool = 'view-parent:hidden';
export const onlyParent = 'view-school:hidden';

/** Spec 19 focus: a 3 px outline in the focus token. */
export const focusRing =
  'focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-site-focus focus-visible:outline-solid';

export const button = cva(
  [
    'inline-flex cursor-pointer items-center gap-3 border-0 font-bold no-underline',
    'transition-transform duration-[250ms] ease-[cubic-bezier(.3,1.6,.5,1)] hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
    focusRing,
  ],
  {
    variants: {
      variant: {
        accent: 'bg-site-accent text-site-on-vivid',
        line: 'border-2 border-solid border-site-navy-border bg-transparent font-semibold text-site-on-navy hover:border-site-lime',
      },
      size: {
        md: 'rounded-2xl px-6 py-4 text-[17px]',
        sm: 'rounded-[14px] px-[18px] py-3 text-[15px]',
      },
    },
    compoundVariants: [{ variant: 'line', size: 'md', className: 'px-[22px] py-3.5' }],
    defaultVariants: { variant: 'accent', size: 'md' },
  },
);

/** The large display headings (prototype `.h2`). */
export const display = 'm-0 font-extrabold tracking-[-.045em] text-balance';
