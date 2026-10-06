/** Spec 03 Motion: 150 ms, cubic-bezier(.2,.8,.2,1), transform and opacity (plus colour), off for reduced motion. */
export const transition =
  'transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none';

/** Spec 03 Accessibility: visible 2 px brand focus ring with a 2 px offset. */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand focus-visible:outline-solid';

/** Spec 03 Icons: Lucide at stroke width 1.9. */
export const ICON_STROKE = 1.9;
