import { cn } from '@quad/ui';

import { site } from './people';

import type { ReactNode } from 'react';

export type DoodleKind =
  | 'star'
  | 'heart'
  | 'sun'
  | 'squiggle'
  | 'kite'
  | 'plane'
  | 'pencil'
  | 'book'
  | 'cloud'
  | 'coin'
  | 'bubble'
  | 'moon';

const INK = site('navy');
const rad = (deg: number) => (deg * Math.PI) / 180;

function rays(colour: string, angles: readonly number[], inner: number, outer: number) {
  return (
    <g stroke={colour} strokeWidth="3" strokeLinecap="round">
      {angles.map((a) => (
        <line
          key={a}
          x1={20 + inner * Math.cos(rad(a))}
          y1={20 + inner * Math.sin(rad(a))}
          x2={20 + outer * Math.cos(rad(a))}
          y2={20 + outer * Math.sin(rad(a))}
        />
      ))}
    </g>
  );
}

const SHAPES: Record<DoodleKind, (c: string) => ReactNode> = {
  star: (c) => (
    <polygon
      points="20,2 25,14.5 38.5,15 28,23.5 31.5,37 20,29.5 8.5,37 12,23.5 1.5,15 15,14.5"
      fill={c}
      stroke={c}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  ),
  heart: (c) => (
    <path
      d="M20 35 C 6 25 2 16 8 10 C 13 5 19 8 20 12 C 21 8 27 5 32 10 C 38 16 34 25 20 35Z"
      fill={c}
    />
  ),
  sun: (c) => (
    <>
      <circle cx="20" cy="20" r="8" fill={c} />
      {rays(c, [0, 45, 90, 135, 180, 225, 270, 315], 12, 17)}
    </>
  ),
  squiggle: (c) => (
    <path
      d="M2 20 Q 8 8 14 20 T 26 20 T 38 20"
      stroke={c}
      strokeWidth="3.5"
      fill="none"
      strokeLinecap="round"
    />
  ),
  kite: (c) => (
    <>
      <polygon points="20,1 33,15 20,28 7,15" fill={c} />
      <path d="M20 1 V28 M7 15 H33" stroke={INK} strokeOpacity=".25" strokeWidth="1.5" />
      <path d="M20 28 Q 14 32 20 35 T 18 40" stroke={c} strokeWidth="2" fill="none" />
    </>
  ),
  plane: (c) => (
    <>
      <polygon points="2,18 38,4 26,36 19,24" fill={c} />
      <path d="M19 24 L38 4" stroke={INK} strokeOpacity=".25" strokeWidth="1.5" />
    </>
  ),
  pencil: (c) => (
    <>
      <polygon points="9,27 27,9 33,15 15,33" fill={c} />
      <polygon points="9,27 15,33 4,38" fill={site('peach')} />
      <polygon points="27,9 30,6 36,12 33,15" fill={site('pink')} />
    </>
  ),
  book: (c) => (
    <>
      <path d="M3 10 Q11 5 20 10 L20 35 Q11 30 3 35Z" fill={c} />
      <path d="M37 10 Q29 5 20 10 L20 35 Q29 30 37 35Z" fill={c} opacity=".75" />
    </>
  ),
  cloud: (c) => (
    <path
      d="M10 31 Q2 31 4 23 Q6 16 14 18 Q16 8 25 10 Q34 10 33 19 Q40 20 38 27 Q37 31 30 31Z"
      fill={c}
    />
  ),
  coin: (c) => (
    <>
      <circle cx="20" cy="20" r="15" fill={c} />
      <circle cx="20" cy="20" r="9.5" fill="none" stroke={INK} strokeOpacity=".3" strokeWidth="2" />
    </>
  ),
  bubble: (c) => (
    <path
      d="M6 6 H34 Q38 6 38 10 V25 Q38 29 34 29 H18 L10 37 L12 29 H6 Q2 29 2 25 V10 Q2 6 6 6Z"
      fill={c}
    />
  ),
  moon: (c) => <path d="M24 3 A17 17 0 1 0 37 29 A13 13 0 1 1 24 3Z" fill={c} />,
};

/**
 * A small flat doodle (star, heart, kite…) from design/landing.html, in one token colour.
 * `motion` is a Tailwind animation class for the shape (applied only without reduced motion).
 * Inside another SVG, `x`, `y` and `size` place it.
 */
export function Doodle({
  kind,
  colour = INK,
  motion,
  x,
  y,
  size,
  className,
}: {
  kind: DoodleKind;
  colour?: string;
  motion?: string;
  x?: number;
  y?: number;
  size?: number;
  className?: string;
}) {
  const place = size === undefined ? {} : { x, y, width: size, height: size };
  return (
    <svg
      viewBox="0 0 40 40"
      {...place}
      aria-hidden="true"
      focusable="false"
      className={cn('overflow-visible', className)}
    >
      <g className={motion ? cn('origin-center [transform-box:fill-box]', motion) : undefined}>
        {SHAPES[kind](colour)}
      </g>
    </svg>
  );
}

/**
 * A doodle floating over a section, placed in percent of its parent (decorative). `left` and
 * `top` are percentages; `size` is in px.
 */
export function FloatingDoodle({
  kind,
  colour,
  left,
  top,
  size,
  motion,
}: {
  kind: DoodleKind;
  colour: string;
  left: string;
  top: string;
  size: number;
  motion: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-[1] size-(--s) top-(--t) left-(--l)"
      style={{ '--l': left, '--t': top, '--s': `${size}px` }}
    >
      <Doodle kind={kind} colour={colour} motion={motion} className="size-full" />
    </div>
  );
}
