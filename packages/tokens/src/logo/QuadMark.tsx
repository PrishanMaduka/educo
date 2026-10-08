import { logoPalette, type LogoVariant } from './palette';

import type { SVGProps } from 'react';

export type QuadMarkProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'width' | 'height'> & {
  variant?: LogoVariant;
  /** Width and height in px. */
  size?: number;
  /** Accessible name; defaults to "Quad". */
  title?: string;
};

/** One rounded petal; the other three are its mirror images (design/brand/quad-mark.svg). */
const PETAL =
  'M0 10A10 10 0 0 1 10 0A3.5 3.5 0 0 1 13.5 3.5V10A3.5 3.5 0 0 1 10 13.5H3.5A3.5 3.5 0 0 1 0 10Z';
const MIRRORS = [
  undefined,
  'translate(30 0) scale(-1 1)',
  'translate(0 30) scale(1 -1)',
  'translate(30 30) scale(-1 -1)',
];

/** The four petals of the mark, shared by the mark and the full logo (30-unit grid). */
export function MarkShapes({ variant = 'color' }: { variant?: LogoVariant }) {
  const { petals } = logoPalette[variant];
  return (
    <>
      {petals.map((fill, i) => (
        <path key={MIRRORS[i] ?? 'top-left'} d={PETAL} fill={fill} transform={MIRRORS[i]} />
      ))}
    </>
  );
}

export function QuadMark({ variant = 'color', size = 32, title = 'Quad', ...rest }: QuadMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 30 30"
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
