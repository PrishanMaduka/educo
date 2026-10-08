'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';

import { cn } from '../lib/cn';

import type { GreetingPeriod } from '@quad/contracts';

/*
 * Port of design/brand/greeting/scenes.js `greetScene` (same 1200 x 320 geometry and per-period elements).
 * Colours are CSS variables from the generated theme, so the scene follows light, dark and the school brand.
 * Animation (the 1.4 s rise and the star twinkle) lives in `@quad/ui/styles.css` under `gs-body` and `gs-star`.
 * It is a client file only because `useId` gives each instance its own gradient, mask and clip ids, and the
 * package's use-client test treats any React hook import that way. It still renders on the server.
 */
const P = {
  surface: 'var(--quad-surface)',
  ink3: 'var(--quad-ink-3)',
  c1: 'var(--quad-c1)',
  c2: 'var(--quad-c2)',
  c3: 'var(--quad-c3)',
  c4: 'var(--quad-c4)',
  c5: 'var(--quad-c5)',
  deep: 'var(--quad-rail)',
};

/** `pct`% of `a` over `b`, as a CSS colour. */
const mix = (a: string, pct: number, b: string): string => `color-mix(in srgb,${a} ${pct}%,${b})`;

const STAR_POINTS: readonly [number, number, number][] = [
  [640, 60, 2],
  [700, 120, 1.6],
  [760, 40, 2.4],
  [820, 96, 1.4],
  [880, 30, 1.8],
  [930, 140, 1.4],
  [1080, 52, 2],
  [1140, 110, 1.6],
  [1170, 36, 1.4],
  [600, 150, 1.4],
  [980, 70, 1.4],
  [1120, 170, 1.2],
];

function Stop({ at, color, opacity }: { at: number; color: string; opacity?: number }) {
  return <stop offset={at} stopColor={color} stopOpacity={opacity} />;
}

function Birds({ color, opacity }: { color: string; opacity: number }) {
  return (
    <g fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" opacity={opacity}>
      <path d="M842 92q9-9 18 0q9-9 18 0" />
      <path d="M892 64q7-7 14 0q7-7 14 0" />
      <path d="M790 120q6-6 12 0q6-6 12 0" />
    </g>
  );
}

function Cloud({ x, y, s, opacity }: { x: number; y: number; s: number; opacity: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s})`}
      fill={mix('white', 34, P.surface)}
      opacity={opacity}
    >
      <ellipse cx="0" cy="10" rx="54" ry="16" />
      <circle cx="-18" cy="0" r="20" />
      <circle cx="12" cy="-6" r="26" />
      <circle cx="38" cy="4" r="16" />
    </g>
  );
}

type Layer = readonly [color: string, opacity: number];

function Hills({ layers }: { layers: readonly [Layer, Layer, Layer, Layer] }) {
  const [a, b, c, d] = layers;
  return (
    <>
      <path
        d="M0 236C170 214 330 226 500 212S820 150 1000 168 1150 176 1200 170V320H0Z"
        fill={a[0]}
        opacity={a[1]}
      />
      <path d="M0 262C210 240 400 258 610 240S960 206 1200 222V320H0Z" fill={b[0]} opacity={b[1]} />
      <path
        d="M0 290C260 272 500 290 760 272S1060 252 1200 262V320H0Z"
        fill={c[0]}
        opacity={c[1]}
      />
      <g fill="none" stroke={P.surface} strokeWidth={2} strokeLinecap="round" opacity={0.35}>
        <path d="M560 300c80-10 170-12 250-6" />
        <path d="M860 290c80-9 170-11 260-6" />
        <path d="M700 312c90-8 190-9 280-4" />
      </g>
      <path
        d="M0 308C300 298 620 310 900 300S1120 292 1200 296V320H0Z"
        fill={d[0]}
        opacity={d[1]}
      />
    </>
  );
}

function Backdrop({ id }: { id: string }) {
  return (
    <>
      <rect width="1200" height="320" fill={`url(#${id}-sky)`} />
      <rect width="1200" height="320" fill={`url(#${id}-glow)`} />
    </>
  );
}

function sceneBody(period: GreetingPeriod, id: string): ReactNode {
  switch (period) {
    case 'morning':
      return (
        <>
          <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
              <Stop at={0} color={P.surface} />
              <Stop at={0.55} color={mix(P.c3, 10, P.surface)} />
              <Stop at={1} color={mix(P.c1, 16, P.surface)} />
            </linearGradient>
            <radialGradient
              id={`${id}-glow`}
              cx="1010"
              cy="190"
              r="300"
              gradientUnits="userSpaceOnUse"
            >
              <Stop at={0} color={P.c1} opacity={0.32} />
              <Stop at={0.45} color={P.c1} opacity={0.1} />
              <Stop at={1} color={P.c1} opacity={0} />
            </radialGradient>
          </defs>
          <Backdrop id={id} />
          <circle className="gs-body" cx="1010" cy="196" r="58" fill={P.c1} opacity={0.85} />
          <Birds color={P.ink3} opacity={0.7} />
          <Hills
            layers={[
              [P.c3, 0.16],
              [P.c3, 0.3],
              [P.c2, 0.42],
              [P.c2, 0.6],
            ]}
          />
        </>
      );
    case 'afternoon':
      return (
        <>
          <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
              <Stop at={0} color={P.surface} />
              <Stop at={0.5} color={mix(P.c5, 9, P.surface)} />
              <Stop at={1} color={mix(P.c4, 20, P.surface)} />
            </linearGradient>
            <radialGradient
              id={`${id}-glow`}
              cx="980"
              cy="86"
              r="260"
              gradientUnits="userSpaceOnUse"
            >
              <Stop at={0} color={P.c4} opacity={0.38} />
              <Stop at={0.5} color={P.c4} opacity={0.1} />
              <Stop at={1} color={P.c4} opacity={0} />
            </radialGradient>
          </defs>
          <Backdrop id={id} />
          <circle
            cx="980"
            cy="86"
            r="74"
            fill="none"
            stroke={P.c4}
            strokeWidth={2}
            strokeDasharray="2 12"
            strokeLinecap="round"
            opacity={0.55}
          />
          <circle className="gs-body" cx="980" cy="86" r="46" fill={P.c4} opacity={0.95} />
          <Cloud x={780} y={96} s={1} opacity={0.9} />
          <Cloud x={1110} y={150} s={0.7} opacity={0.8} />
          <Cloud x={640} y={140} s={0.55} opacity={0.7} />
          <Hills
            layers={[
              [P.c5, 0.16],
              [P.c5, 0.28],
              [P.c2, 0.4],
              [P.c2, 0.58],
            ]}
          />
        </>
      );
    case 'evening':
      return (
        <>
          <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
              <Stop at={0} color={P.surface} />
              <Stop at={0.4} color={mix(P.c3, 14, P.surface)} />
              <Stop at={0.75} color={mix(P.c1, 26, P.surface)} />
              <Stop at={1} color={mix(P.c4, 34, P.surface)} />
            </linearGradient>
            <radialGradient
              id={`${id}-glow`}
              cx="1000"
              cy="250"
              r="360"
              gradientUnits="userSpaceOnUse"
            >
              <Stop at={0} color={P.c4} opacity={0.5} />
              <Stop at={0.35} color={P.c1} opacity={0.22} />
              <Stop at={1} color={P.c1} opacity={0} />
            </radialGradient>
            <linearGradient id={`${id}-sun`} x1="0" y1="0" x2="0" y2="1">
              <Stop at={0} color={P.c4} />
              <Stop at={1} color={P.c1} />
            </linearGradient>
            <clipPath id={`${id}-hz`}>
              <path d="M0 0H1200V170C1150 176 1100 168 1000 168S820 150 500 212 170 214 0 236Z" />
            </clipPath>
          </defs>
          <Backdrop id={id} />
          <g clipPath={`url(#${id}-hz)`}>
            <circle className="gs-body" cx="1000" cy="214" r="78" fill={`url(#${id}-sun)`} />
          </g>
          <g stroke={P.c1} strokeWidth={3} strokeLinecap="round" opacity={0.35}>
            <path d="M900 150h-46M1100 150h46M930 106l-30-22M1070 106l30-22M1000 84V56" />
          </g>
          <Birds color={P.deep} opacity={0.55} />
          <Hills
            layers={[
              [P.c3, 0.26],
              [P.c2, 0.38],
              [P.deep, 0.5],
              [P.deep, 0.72],
            ]}
          />
        </>
      );
    case 'night':
      return (
        <>
          <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2=".6">
              <Stop at={0} color={P.surface} />
              <Stop at={0.38} color={mix(P.c3, 16, P.surface)} />
              <Stop at={0.7} color={mix(P.c2, 42, P.surface)} />
              <Stop at={1} color={mix(P.deep, 78, P.surface)} />
            </linearGradient>
            <radialGradient
              id={`${id}-glow`}
              cx="1010"
              cy="96"
              r="200"
              gradientUnits="userSpaceOnUse"
            >
              <Stop at={0} color={P.c3} opacity={0.4} />
              <Stop at={1} color={P.c3} opacity={0} />
            </radialGradient>
            <mask id={`${id}-moon`}>
              <rect width="1200" height="320" fill="white" />
              <circle cx="1032" cy="80" r="40" fill="black" />
            </mask>
          </defs>
          <Backdrop id={id} />
          <g fill="white">
            {STAR_POINTS.map(([x, y, r], i) => (
              <circle
                key={`${x}-${y}`}
                className="gs-star"
                cx={x}
                cy={y}
                r={r}
                opacity={0.55 + (i % 3) * 0.15}
                style={{ '--gs-delay': `${(i % 5) * 0.6}s` } as CSSProperties}
              />
            ))}
          </g>
          <circle
            className="gs-body"
            cx="1010"
            cy="96"
            r="44"
            fill={mix('white', 78, P.c3)}
            mask={`url(#${id}-moon)`}
          />
          <Hills
            layers={[
              [P.c3, 0.22],
              [P.c2, 0.42],
              [P.deep, 0.6],
              [P.deep, 0.82],
            ]}
          />
        </>
      );
  }
}

export interface GreetingSceneProps {
  period: GreetingPeriod;
  /** Size and position come from the caller, for example `absolute inset-0 h-full w-full`. */
  className?: string;
}

/** The time-of-day picture behind the greeting. Decorative, so hidden from screen readers. */
export function GreetingScene({ period, className }: GreetingSceneProps) {
  const id = `gs${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1200 320"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      focusable="false"
      className={cn('gscene', `gs-${period}`, className)}
    >
      {sceneBody(period, id)}
    </svg>
  );
}
