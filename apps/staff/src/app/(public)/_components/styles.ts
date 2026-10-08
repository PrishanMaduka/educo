import { cva } from 'class-variance-authority';

/*
 * Class strings shared by the public landing page sections (spec 19, design/landing.html). Token
 * utilities only; palette B comes from the `[data-site="public"]` scope set by the layout.
 */

/** The 1120 px column. */
export const wrap = 'mx-auto w-full max-w-[1120px] px-5 max-[480px]:px-4';

export const eyebrow = 'text-[12.5px] font-extrabold uppercase tracking-[.12em] text-coral-ink';

export const h2 =
  'm-0 text-[clamp(30px,4.2vw,44px)] leading-[1.08] font-black tracking-[-.025em] text-balance';

export const h3 = 'm-0 text-xl leading-[1.25] font-extrabold tracking-[-.01em] text-balance';

export const lede = 'm-0 max-w-[58ch] text-[18.5px] text-ink-2';

/** The serif accent word in headings (`font-accent`, public pages only). */
export const accent = 'font-accent font-medium italic tracking-[-.01em]';

/** Spec 19 focus: a 2.5 px coral outline. */
export const focusRing =
  'focus-visible:outline-[2.5px] focus-visible:outline-offset-[3px] focus-visible:outline-coral-ink focus-visible:outline-solid';

export const button = cva(
  [
    'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-pill border-[1.5px] font-extrabold no-underline',
    'transition-[transform,box-shadow,background-color,border-color] duration-150 motion-reduce:transition-none',
    focusRing,
  ],
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-coral-fill text-coral-fill-ink shadow-[0_12px_24px_-12px_var(--quad-c1)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
        ghost: 'border-line bg-surface text-ink hover:border-ink-3',
      },
      size: {
        lg: 'h-12 px-[22px] text-[15.5px]',
        nav: 'h-10 px-[18px] text-sm max-[900px]:h-11 max-[480px]:px-[13px] max-[480px]:text-[13.5px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'lg' },
  },
);

/** A text button that reads like a link (Sign in to your school). */
export const linkButton = `cursor-pointer border-0 bg-transparent p-0 font-extrabold text-coral-ink ${focusRing}`;
