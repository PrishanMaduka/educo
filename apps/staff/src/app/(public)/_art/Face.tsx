import { cn } from '@quad/ui';

import { PEOPLE, ROLE_COLOUR, site, type PersonId } from './people';

/** The id of the round crop every face uses, defined once by `SiteArtDefs`. */
export const FACE_CLIP = 'site-face-clip';

const INK = site('navy');

export type Mood = 'happy' | 'laugh' | 'worried';

function Hair({ who }: { who: PersonId }) {
  const { hair, style } = PEOPLE[who];
  const fill = site(hair);
  const short = (
    <path d="M26 47 Q26 21 50 21 Q74 21 74 47 Q68 33 50 33 Q34 33 26 47Z" fill={fill} />
  );
  switch (style) {
    case 'short':
      return short;
    case 'bun':
    case 'grandma':
      return (
        <>
          {short}
          <circle cx="50" cy="18" r="9" fill={fill} />
        </>
      );
    case 'long':
      return (
        <path
          d="M23 68 Q19 21 50 20 Q81 21 77 68 Q71 62 71 46 Q64 33 50 33 Q36 33 29 46 Q29 62 23 68Z"
          fill={fill}
        />
      );
    case 'pigtails':
      return (
        <>
          <circle cx="22" cy="48" r="9" fill={fill} />
          <circle cx="78" cy="48" r="9" fill={fill} />
          {short}
          <circle cx="22" cy="48" r="3" fill={site('pink')} />
          <circle cx="78" cy="48" r="3" fill={site('pink')} />
        </>
      );
    case 'curly':
      return (
        <>
          {(
            [
              [28, 40],
              [34, 28],
              [46, 22],
              [58, 23],
              [68, 30],
              [73, 42],
            ] as const
          ).map(([cx, cy]) => (
            <circle key={cx} cx={cx} cy={cy} r="9.5" fill={fill} />
          ))}
        </>
      );
    case 'cap':
      return (
        <>
          {short}
          <path d="M25 40 Q26 16 50 16 Q74 16 75 40Z" fill={site('orange')} />
          <rect x="48" y="36" width="34" height="6" rx="3" fill={site('orange')} />
        </>
      );
    case 'beard':
      return (
        <>
          {short}
          <path d="M28 52 Q30 76 50 76 Q70 76 72 52 Q64 64 50 64 Q36 64 28 52Z" fill={fill} />
        </>
      );
  }
}

function Mouth({ mood }: { mood: Mood }) {
  if (mood === 'laugh') return <path d="M41 57 Q50 70 59 57Z" fill={INK} />;
  const d = mood === 'worried' ? 'M43 63 Q50 58 57 63' : 'M42 58 Q50 66 58 58';
  return <path d={d} stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />;
}

/**
 * A flat avatar face on its role colour (design/landing.html `face()`): skin, hair, blinking eyes,
 * rosy cheeks and a mouth for the mood. Decorative: the name is always written beside it. Inside
 * another SVG, `x`, `y` and `size` place it; otherwise it fills its box.
 */
export function Face({
  who,
  mood = 'happy',
  bg,
  x,
  y,
  size,
  className,
}: {
  who: PersonId;
  mood?: Mood;
  /** The circle behind the face; the role colour by default. */
  bg?: string;
  x?: number;
  y?: number;
  size?: number;
  className?: string;
}) {
  const person = PEOPLE[who];
  const eyeHeight = mood === 'worried' ? 2.6 : 3.3;
  const place =
    size === undefined ? { width: '100%', height: '100%' } : { x, y, width: size, height: size };
  return (
    <svg
      viewBox="0 0 100 100"
      {...place}
      aria-hidden="true"
      focusable="false"
      className={cn('block overflow-visible', className)}
    >
      <g clipPath={`url(#${FACE_CLIP})`}>
        <circle cx="50" cy="50" r="50" fill={bg ?? ROLE_COLOUR[person.role]} />
        <path d="M12 104 Q14 76 50 74 Q86 76 88 104Z" fill={site('white')} />
        <circle cx="50" cy="49" r="24" fill={site(person.skin)} />
        <Hair who={who} />
        <g
          className={cn(
            'origin-center [transform-box:fill-box] motion-safe:animate-blink',
            person.blink,
          )}
        >
          <ellipse cx="41.5" cy="50" rx="2.7" ry={eyeHeight} fill={INK} />
          <ellipse cx="58.5" cy="50" rx="2.7" ry={eyeHeight} fill={INK} />
        </g>
        {mood === 'worried' ? (
          <path
            d="M37 43 L45 45 M63 43 L55 45"
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : null}
        <circle cx="35" cy="58" r="4" fill={site('blush')} opacity=".45" />
        <circle cx="65" cy="58" r="4" fill={site('blush')} opacity=".45" />
        <Mouth mood={mood} />
        {person.style === 'grandma' ? (
          <g stroke={INK} strokeWidth="1.8" fill="none">
            <circle cx="41.5" cy="50" r="6" />
            <circle cx="58.5" cy="50" r="6" />
            <path d="M47.5 50 H52.5" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}

/** Shared SVG definitions for the site's art, rendered once by the layout. */
export function SiteArtDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={FACE_CLIP}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
    </svg>
  );
}
