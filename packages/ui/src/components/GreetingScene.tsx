import { cn } from '../lib/cn';

import type { GreetingPeriod } from '@quad/contracts';
import type { CSSProperties, ReactNode } from 'react';

/*
 * Port of design/brand/greeting/scenes.js `greetScene` (D38, flat style): solid fills only, no gradients,
 * glows or see-through layers. Everything is drawn in a 600 x 300 box placed at the bottom right of the
 * 1200 x 320 view box; the rest is transparent, so the card colour shows through.
 * Colours are CSS variables from the generated theme, so the scene follows light, dark and the school brand.
 * `c1`–`c5` are pink, violet, sky, orange and lime in the spec 03 palette (spec 03 keeps their order for the
 * scenes); the roles below pick tokens that read on the card in both themes.
 * Animation (the 1.4 s rise and the star twinkle) lives in `@quad/ui/styles.css` under `gs-body` and `gs-star`.
 */
const P = {
  pink: 'var(--quad-c1)',
  violet: 'var(--quad-c2)',
  sky: 'var(--quad-c3)',
  orange: 'var(--quad-c4)',
  lime: 'var(--quad-c5)',
  /** The navy-line hills and the kite's spars. */
  navyLine: 'var(--quad-rail-2)',
  /** The front night hill. */
  deep: 'var(--quad-rail)',
  /** Birds and the kite's string. */
  muted: 'var(--quad-ink-3)',
  cloud: 'var(--quad-line-strong)',
  /** The moon and the small stars: cream in dark mode, deep enough to read on white in light mode. */
  moon: 'var(--quad-ink-2)',
};

const CRESCENT = 'M34.71 19.89A40 40 0 1 1 -5.01 -39.69A36 36 0 0 0 34.71 19.89Z';
const HILL_BACK = 'M90 300C170 238 300 214 410 240S560 222 600 214V300Z';
const HILL_FRONT = 'M0 300C110 270 250 258 370 276S530 262 600 268V300Z';

const STARS: readonly [x: number, y: number, r: number, color: string][] = [
  [330, 70, 7, P.lime],
  [560, 150, 6, P.moon],
  [400, 150, 4, P.moon],
  [250, 120, 5, P.moon],
  [590, 50, 5, P.lime],
  [180, 60, 4, P.moon],
  [520, 30, 4, P.moon],
];

/** A four-point sparkle centred on (x, y). */
const sparklePath = (r: number): string => {
  const q = +(r * 0.18).toFixed(2);
  return `M0 -${r}Q${q} -${q} ${r} 0Q${q} ${q} 0 ${r}Q-${q} ${q} -${r} 0Q-${q} -${q} 0 -${r}Z`;
};

function Sparkle({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return <path transform={`translate(${x} ${y})`} d={sparklePath(r)} fill={color} />;
}

/** The dashed ring around a sun. */
function Ring({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeDasharray="2 11"
      strokeLinecap="round"
    />
  );
}

function Sun({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return <circle className="gs-body" cx={x} cy={y} r={r} fill={color} />;
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={P.cloud}>
      <rect x="-40" y="0" width="92" height="22" rx="11" />
      <circle cx="-10" cy="2" r="17" />
      <circle cx="16" cy="-4" r="22" />
    </g>
  );
}

function Birds() {
  return (
    <g fill="none" stroke={P.muted} strokeWidth={2.2} strokeLinecap="round">
      <path d="M330 120q7-7 14 0q7-7 14 0" />
      <path d="M372 96q6-6 12 0q6-6 12 0" />
    </g>
  );
}

function Kite() {
  return (
    <g transform="translate(250 64) rotate(-12)">
      <path d="M0 -20L14 0L0 22L-14 0Z" fill={P.orange} />
      <path d="M0 -20V22M-14 0H14" fill="none" stroke={P.navyLine} strokeWidth={1.6} />
      <path
        d="M0 22c-6 14 8 22 0 36s6 18 2 26"
        fill="none"
        stroke={P.muted}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}

function Hills({ back, front }: { back: string; front: string }) {
  return (
    <>
      <path d={HILL_BACK} fill={back} />
      <path d={HILL_FRONT} fill={front} />
    </>
  );
}

function sceneBody(period: GreetingPeriod): ReactNode {
  switch (period) {
    case 'morning':
      return (
        <>
          <Ring x={470} y={214} r={84} color={P.orange} />
          <Sun x={470} y={214} r={58} color={P.orange} />
          <Cloud x={330} y={70} s={0.9} />
          <Birds />
          <Kite />
          <Hills back={P.sky} front={P.lime} />
          <Sparkle x={560} y={58} r={9} color={P.lime} />
        </>
      );
    case 'afternoon':
      return (
        <>
          <Ring x={480} y={92} r={70} color={P.lime} />
          <Sun x={480} y={92} r={44} color={P.lime} />
          <Cloud x={340} y={120} s={1} />
          <Cloud x={560} y={170} s={0.6} />
          <Kite />
          <Hills back={P.sky} front={P.orange} />
          <Sparkle x={390} y={46} r={8} color={P.pink} />
        </>
      );
    case 'evening':
      return (
        <>
          <Sun x={460} y={250} r={78} color={P.pink} />
          <Ring x={460} y={250} r={104} color={P.pink} />
          <Birds />
          <Hills back={P.violet} front={P.navyLine} />
          <Sparkle x={300} y={60} r={8} color={P.orange} />
          <path d="M560 70c-6-8-18-2-12 8l12 12 12-12c6-10-6-16-12-8z" fill={P.pink} />
        </>
      );
    case 'night':
      return (
        <>
          <path className="gs-body" transform="translate(470 96)" d={CRESCENT} fill={P.moon} />
          {STARS.map(([x, y, r, color], i) => (
            <path
              key={`${x}-${y}`}
              className="gs-star"
              transform={`translate(${x} ${y})`}
              d={sparklePath(r)}
              fill={color}
              style={{ '--gs-delay': `${(i % 5) * 0.6}s` } as CSSProperties}
            />
          ))}
          <Hills back={P.navyLine} front={P.deep} />
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
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1200 320"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      focusable="false"
      className={cn('gscene', `gs-${period}`, className)}
    >
      <g transform="translate(600 20)">{sceneBody(period)}</g>
    </svg>
  );
}
