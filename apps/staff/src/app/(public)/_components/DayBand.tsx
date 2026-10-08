import { cn } from '@quad/ui';

import { dayScenes, type DayScene } from '../_illustrations/day';
import { Painting } from '../_illustrations/Painting';
import { smallIcons } from '../_illustrations/sections';

import { SectionHead } from './SectionHead';
import { button, wrap } from './styles';

import { SLOT_MARKER, t } from '@/i18n';

type Tag = 'teal' | 'coral' | 'amber' | 'lilac';

/** Seven timed steps in Amaya's Monday, each with its timeline dot, tag colour and vignette. */
const STEPS: readonly { key: DayScene; dot: string; tag: Tag }[] = [
  { key: 'arrive', dot: 'bg-c5', tag: 'teal' },
  { key: 'moment', dot: 'bg-c1', tag: 'coral' },
  { key: 'grandma', dot: 'bg-c4', tag: 'amber' },
  { key: 'people', dot: 'bg-c3', tag: 'lilac' },
  { key: 'try', dot: 'bg-c5', tag: 'teal' },
  { key: 'quiet', dot: 'bg-c2', tag: 'lilac' },
  { key: 'recap', dot: 'bg-c1', tag: 'coral' },
];

const TAG: Record<Tag, string> = {
  teal: 'bg-band-tag-teal-bg text-band-tag-teal-ink',
  coral: 'bg-band-tag-coral-bg text-band-tag-coral-ink',
  amber: 'bg-band-tag-amber-bg text-band-tag-amber-ink',
  lilac: 'bg-band-tag-lilac-bg text-band-tag-lilac-ink',
};

/** One school day in Amaya's circle (spec 19 §6): the dark band, the bold moment of the page. */
export function DayBand() {
  return (
    <section
      id="day"
      aria-labelledby="day-title"
      className="bg-band bg-[radial-gradient(900px_500px_at_85%_-10%,var(--quad-band-2),transparent_60%)] py-24 text-band-ink max-[820px]:py-16"
    >
      <div className={wrap}>
        <SectionHead
          id="day-title"
          tone="band"
          eyebrow={t('public.day.eyebrow')}
          title={t('public.day.title', { accent: SLOT_MARKER })}
          accent={t('public.day.titleAccent')}
          lede={t('public.day.lede')}
        />
        <ol className="relative m-0 grid list-none p-0 before:absolute before:top-2 before:bottom-2 before:left-[84px] before:w-0.5 before:bg-band-line before:content-[''] max-[900px]:before:left-[66px] max-[480px]:before:left-[63px]">
          {STEPS.map(({ key, dot, tag }) => (
            <li
              key={key}
              className="reveal-on-scroll grid grid-cols-[70px_30px_minmax(0,1fr)_minmax(0,.95fr)] items-center gap-x-6 border-t border-band-line py-[22px] first:border-t-0 max-[900px]:grid-cols-[52px_30px_minmax(0,1fr)] max-[480px]:grid-cols-[44px_26px_minmax(0,1fr)] max-[480px]:gap-x-3"
            >
              <span className="self-start pt-1 text-right text-[15px] font-extrabold text-band-ink-2 tabular-nums max-[900px]:text-[13.5px]">
                {t(`public.day.${key}.time`)}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'relative z-[1] mt-2 ml-[7px] size-4 self-start rounded-full shadow-[0_0_0_5px_var(--quad-band)] max-[480px]:ml-[5px]',
                  dot,
                )}
              />
              <div>
                <span
                  className={cn(
                    'mb-2 inline-block rounded-pill px-2.5 py-[3px] text-[11.5px] font-extrabold tracking-[.1em] uppercase',
                    TAG[tag],
                  )}
                >
                  {t(`public.day.${key}.tag`)}
                </span>
                <h3 className="m-0 text-[22px] leading-[1.25] font-extrabold tracking-[-.01em] text-balance text-band-ink">
                  {t(`public.day.${key}.title`)}
                </h3>
                <p className="m-0 mt-1.5 max-w-[48ch] text-[15.5px] text-band-ink-2">
                  {t(`public.day.${key}.body`)}
                </p>
              </div>
              <div className="w-full max-w-[420px] min-w-0 justify-self-end max-[900px]:col-start-3 max-[900px]:mt-4 max-[900px]:justify-self-start">
                <Painting
                  viewBox="0 0 400 200"
                  paint={dayScenes[key]}
                  className="overflow-hidden rounded-[20px]"
                />
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-11 flex flex-wrap items-center gap-3 border-t border-band-line pt-7">
          <Painting viewBox="0 0 44 44" paint={smallIcons.shield} className="size-11 flex-none" />
          <p className="m-0 min-w-[240px] flex-1 text-band-ink-2">{t('public.day.foot')}</p>
          <a href="#demo" className={button()}>
            {t('public.bookDemo')}
          </a>
        </div>
      </div>
    </section>
  );
}
