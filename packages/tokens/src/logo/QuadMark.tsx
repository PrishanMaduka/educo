import { logoPalette, type LogoVariant } from './palette';

import type { SVGProps } from 'react';

export type QuadMarkProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'width' | 'height'> & {
  variant?: LogoVariant;
  /** Width and height in px. */
  size?: number;
  /** Accessible name; defaults to "Quad". */
  title?: string;
};

/** The four tiles of the mark, shared by the mark and the full logo (64-unit grid). */
export function MarkShapes({ variant = 'color' }: { variant?: LogoVariant }) {
  const p = logoPalette[variant];
  return (
    <>
      <rect x="9" y="9" width="21" height="21" rx="7" fill={p.school} />
      <rect x="34" y="9" width="21" height="21" rx="7" fill={p.people} />
      <rect x="9" y="34" width="21" height="21" rx="7" fill={p.people} />
      <rect x="34" y="34" width="21" height="21" rx="7" fill={p.students} />
      <path d="M49 49l9 9" stroke={p.students} strokeWidth="7" strokeLinecap="round" />
    </>
  );
}

export function QuadMark({ variant = 'color', size = 32, title = 'Quad', ...rest }: QuadMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      {...rest}
    >
      <title>{title}</title>
      <MarkShapes variant={variant} />
    </svg>
  );
}
