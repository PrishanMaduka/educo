import { GreetingScene } from '@quad/ui';

import type { GreetingPeriod } from '@quad/domain';

import { SLOT_MARKER, splitAround, t } from '@/i18n';

export interface GreetingProps {
  period: GreetingPeriod;
  /** "Good morning", already translated. */
  greeting: string;
  firstName: string;
  /** "Wednesday 7 October", in the school's time zone. */
  dateLine: string;
  summary: string;
}

/**
 * Spec 03 "The greeting section": the time-of-day scene behind the whole section, text on the calm left side
 * (about 64%), the first name under the lilac marker. On narrow screens the scene is a 130 px band at the bottom.
 */
export function Greeting({ period, greeting, firstName, dateLine, summary }: GreetingProps) {
  const [before, after] = splitAround(
    t('home.staff.greeting', { greeting, name: SLOT_MARKER }),
    SLOT_MARKER,
  );
  return (
    <section
      aria-labelledby="greeting-title"
      className="relative flex min-h-[300px] items-end overflow-hidden rounded-[28px] border border-line bg-surface px-[34px] pt-8 pb-[70px] shadow-card max-[860px]:min-h-0 max-[860px]:px-[22px] max-[860px]:pt-[22px] max-[860px]:pb-[132px]"
    >
      <GreetingScene
        period={period}
        className="pointer-events-none absolute inset-0 z-0 block h-full w-full max-[860px]:top-auto max-[860px]:h-[130px]"
      />
      <div className="relative z-[1] max-w-[min(640px,64%)] min-w-0 flex-1 max-[860px]:max-w-none">
        <p className="m-0 text-[13px] font-bold text-ink-2">{dateLine}</p>
        <h1
          id="greeting-title"
          className="mt-1.5 mb-2.5 text-[clamp(30px,3.4vw,44px)] leading-[1.15] font-extrabold tracking-[-0.02em] text-balance text-ink"
        >
          {before}
          <span className="marker-highlight">{firstName}</span>
          {after}
        </h1>
        <p className="m-0 max-w-[62ch] text-[16.5px] leading-[1.55] text-ink-2">{summary}</p>
      </div>
    </section>
  );
}
