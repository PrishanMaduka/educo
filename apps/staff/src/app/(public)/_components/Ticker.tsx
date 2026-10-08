import { Doodle, type DoodleKind } from '../_art/Doodle';

import { t } from '@/i18n';

const ITEMS = ['mural', 'swim', 'grandma', 'pancakes', 'leo', 'quiet', 'fractions'] as const;
const MARKS: readonly DoodleKind[] = ['star', 'heart', 'sun', 'kite'];

function Row() {
  return (
    <div className="flex items-center gap-7 pr-7">
      {ITEMS.map((key, i) => (
        <span key={key} className="flex items-center gap-7">
          <span className="text-[clamp(18px,2vw,26px)] font-extrabold tracking-[-.02em] whitespace-nowrap">
            {t(`public.ticker.${key}`)}
          </span>
          <Doodle kind={MARKS[i % MARKS.length] ?? 'star'} className="size-[22px] flex-none" />
        </span>
      ))}
    </div>
  );
}

/**
 * The tilted lime band of good news under the hero (spec 19). Decorative: the same moments are told
 * in the sections below, so it is hidden from screen readers. It scrolls unless motion is reduced.
 */
export function Ticker() {
  return (
    <div
      aria-hidden="true"
      className="relative z-[3] -mx-5 rotate-[-1.2deg] overflow-hidden bg-site-lime py-3.5 text-site-on-vivid"
    >
      <div className="flex w-max motion-safe:animate-marquee">
        <Row />
        <Row />
      </div>
    </div>
  );
}
