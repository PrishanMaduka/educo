import { cn } from '@quad/ui';

import { site } from '../_art/people';
import { StepScene, type StepSceneKind } from '../_art/StepScene';

import { display, onlyParent, onlySchool, wrap } from './styles';

import { t } from '@/i18n';

const STEPS: readonly { key: StepSceneKind; colour: string }[] = [
  { key: 'moment', colour: site('sky') },
  { key: 'thanks', colour: site('pink') },
  { key: 'try', colour: site('orange') },
  { key: 'sees', colour: site('lime') },
];

const STEP_KEY = { moment: 'moment', thanks: 'thanks', try: 'try', sees: 'sees' } as const;

/** One week, round the circle (spec 19): four steps from school to home and back. */
export function Circle() {
  const lede = 'm-0 max-w-[28em] flex-[1_1_300px] text-lg leading-[1.5] text-site-page-ink-2';
  return (
    <section
      id="circle"
      aria-labelledby="circle-title"
      className="-mt-3.5 bg-site-page-bg pt-3.5 text-site-page-ink"
    >
      <div className={cn(wrap, 'py-[clamp(64px,8vw,120px)]')}>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-x-16 gap-y-5">
          <div className="flex-[1_1_460px]">
            <p className="m-0 mb-3.5 text-[15px] font-bold text-site-page-ink-2">
              {t('public.circle.eyebrow')}
            </p>
            <h2
              id="circle-title"
              className={cn(display, 'text-[clamp(40px,5.4vw,84px)] leading-[.92]')}
            >
              {t('public.circle.title')}
            </h2>
          </div>
          <p className={cn(lede, onlySchool)}>{t('public.circle.school.lede')}</p>
          <p className={cn(lede, onlyParent)}>{t('public.circle.parent.lede')}</p>
        </div>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] gap-4 p-0">
          {STEPS.map(({ key, colour }, i) => (
            <li
              key={key}
              className="flex flex-col gap-2.5 rounded-[30px] bg-(--c) px-3.5 pt-3.5 pb-[26px] text-site-on-vivid transition-transform duration-[350ms] ease-[cubic-bezier(.3,1.6,.5,1)] hover:-translate-y-2 hover:rotate-[-1deg] motion-reduce:transition-none motion-reduce:hover:transform-none"
              style={{ '--c': colour }}
            >
              <div className="aspect-[10/7] overflow-hidden rounded-[20px] bg-site-white/55">
                <StepScene kind={key} clock={t('public.circle.clock')} />
              </div>
              <div className="mt-1 flex items-center gap-2.5 text-[13px] font-bold">
                <span
                  aria-hidden="true"
                  className="grid size-[34px] place-items-center rounded-full bg-site-navy text-base font-extrabold text-site-paper"
                >
                  {i + 1}
                </span>
                <span className={onlySchool}>{t(`public.circle.${STEP_KEY[key]}.where`)}</span>
                <span className={onlyParent}>
                  {t(`public.circle.${STEP_KEY[key]}.parent.where`)}
                </span>
              </div>
              <strong className="text-[25px] leading-[1.05] tracking-[-.03em]">
                <span className={onlySchool}>{t(`public.circle.${STEP_KEY[key]}.title`)}</span>
                <span className={onlyParent}>
                  {t(`public.circle.${STEP_KEY[key]}.parent.title`)}
                </span>
              </strong>
              <span className="text-[15px] leading-[1.5]">
                <span className={onlySchool}>{t(`public.circle.${STEP_KEY[key]}.body`)}</span>
                <span className={onlyParent}>
                  {t(`public.circle.${STEP_KEY[key]}.parent.body`)}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="m-0 mt-7 flex items-center gap-3 text-[15px] font-bold text-site-page-ink-2">
          <span
            aria-hidden="true"
            className="inline-block text-[22px] motion-safe:animate-spin-slow"
          >
            ↻
          </span>
          {t('public.circle.again')}
        </p>
      </div>
    </section>
  );
}
