import { cn } from '@quad/ui';
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

/** A link in the footer's coloured cards (navy ink in both themes). */
export const footerLink =
  'inline-block rounded-sm py-1 text-site-on-vivid no-underline hover:underline ' + focusRing;

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
        navy: 'bg-site-navy text-site-on-navy',
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

/**
 * Body text on the About, Security & trust and legal pages: paragraphs, lists, small headings,
 * links and tables, all on the `site-*` tokens. `page` is for white cards, `tint` for the pale
 * sky, pink, lime and orange cards (navy ink in both themes), `navy` for the navy card.
 */
export const prose = cva(
  [
    '[&>:first-child]:mt-0 [&>:last-child]:mb-0',
    '[&_p]:my-3.5 [&_ul]:my-3.5 [&_ul]:pl-5 [&_ol]:my-3.5 [&_ol]:pl-5 [&_li]:my-1.5 [&_li]:pl-1',
    '[&_strong]:font-bold [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-bold',
    '[&_a]:rounded-sm [&_a]:font-semibold [&_a]:wrap-anywhere [&_a]:underline [&_a]:decoration-2 [&_a]:underline-offset-[3px]',
    '[&_a:focus-visible]:outline-[3px] [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-site-focus [&_a:focus-visible]:outline-solid',
  ],
  {
    variants: {
      tone: {
        page: 'text-site-page-ink-2 [&_a]:text-site-page-ink [&_h3]:text-site-page-ink [&_li]:marker:text-site-page-ink-3 [&_strong]:text-site-page-ink',
        tint: 'text-site-on-vivid [&_a]:text-site-on-vivid [&_h3]:text-site-on-vivid [&_li]:marker:text-site-on-vivid [&_strong]:text-site-on-vivid',
        navy: 'text-site-on-navy-2 [&_a]:text-site-lime [&_strong]:text-site-on-navy',
      },
      // Line height after the size, so cn() keeps it (tailwind-merge drops a leading-* before a text-*).
      size: { md: 'text-[17px] leading-[1.65]', sm: 'text-[15.5px] leading-[1.6]' },
    },
    defaultVariants: { tone: 'page', size: 'md' },
  },
);

/** The white card the About and legal sections sit on. */
export const card =
  'rounded-[28px] border border-solid border-site-card-line bg-site-card-bg p-[clamp(20px,2.6vw,32px)] shadow-[0_10px_30px_var(--quad-site-feed-shadow)]';

/** The pale card in one of the mark's colours (navy ink in both themes). */
export const tintCard = cva('rounded-[28px] p-[clamp(20px,2.6vw,32px)] text-site-on-vivid', {
  variants: {
    tint: {
      sky: 'bg-site-chip-sky-bg',
      pink: 'bg-site-chip-pink-bg',
      lime: 'bg-site-tag-good-bg',
      orange: 'bg-site-chip-orange-bg',
    },
  },
});

/** The first card on a page rises into the navy header. */
export const lift = 'relative z-[2] mt-[clamp(-72px,-5vw,-44px)]';

/** A link inside the demo panel's navy card (the support address, the email fallback). */
export const inlineLink = cn('text-site-lime', focusRing);
