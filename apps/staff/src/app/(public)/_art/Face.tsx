import { cn } from '@quad/ui';

import { faceMarkup, headClipId, headPath, type Mood } from './face-markup';
import { PEOPLE, type PersonId } from './people';

export type { Mood };

const PERSON_IDS = Object.keys(PEOPLE) as PersonId[];

/** The id of the round crop every face uses, defined once by `SiteArtDefs`. */
export const FACE_CLIP = 'site-face-clip';

/**
 * A flat avatar face on its role colour (design/landing.html `face()`; the shapes are in
 * `face-markup.ts`). Decorative: the name is always written beside it. Inside another SVG, `x`,
 * `y` and `size` place it; otherwise it fills its box.
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
      {/* Static markup from constants (no visitor input), built by a pure helper. */}
      <g
        clipPath={`url(#${FACE_CLIP})`}
        dangerouslySetInnerHTML={{ __html: faceMarkup(who, mood, bg) }}
      />
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
        {PERSON_IDS.map((who) => (
          <clipPath key={who} id={headClipId(who)}>
            <path d={headPath(who)} />
          </clipPath>
        ))}
      </defs>
    </svg>
  );
}
