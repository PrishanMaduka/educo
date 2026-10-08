import { cn } from '@quad/ui';

import { circleDiagram, loopScenes, ruleIcons } from '../_illustrations/circle';
import { Painting } from '../_illustrations/Painting';

import { LoopArt } from './LoopArt';
import { SectionHead } from './SectionHead';
import { wrap } from './styles';

import { SLOT_MARKER, t } from '@/i18n';

const HOME_PEOPLE = ['dilhani', 'ruwan', 'kamala'] as const;
const SCHOOL_PEOPLE = ['jaya', 'perera', 'herath', 'silva', 'dias', 'sunethra'] as const;
const STEPS = ['moment', 'thanks', 'try', 'pulse'] as const;
const RULES = ['family', 'photos', 'quiet', 'records'] as const;

/*
 * The loop: 1 at the top, 2 right, 3 bottom, 4 left, round "Every week, round again" (prototype
 * `.loop`). At 620 px and below it becomes a column, pictures on the left and captions beside them.
 */
const STEP_PLACE = [
  'col-span-3 row-start-1 w-[min(260px,56%)] justify-self-center',
  'col-start-3 row-start-2',
  'col-span-3 row-start-3 w-[min(260px,56%)] justify-self-center',
  'col-start-1 row-start-2',
] as const;
const STEP_TEXT = [
  'max-w-[78%]',
  'self-end text-right max-w-[82%]',
  'max-w-[78%]',
  'self-start text-left max-w-[82%]',
] as const;
const NARROW_ITEM =
  'max-[620px]:grid max-[620px]:w-auto max-[620px]:grid-cols-[44%_minmax(0,1fr)] max-[620px]:items-center max-[620px]:gap-x-3.5 max-[620px]:p-0 max-[620px]:text-left';
const NARROW_TEXT =
  'max-[620px]:col-start-2 max-[620px]:max-w-none max-[620px]:self-auto max-[620px]:text-left';

function PeopleGroup({
  title,
  ring,
  people,
}: {
  title: string;
  ring: string;
  people: readonly string[];
}) {
  return (
    <div>
      <p className="m-0 flex items-center gap-2 text-[13px] font-extrabold tracking-[.1em] text-ink-2 uppercase">
        <span aria-hidden="true" className={cn('size-[11px] rounded-full border-[3px]', ring)} />
        {title}
      </p>
      <ul className="m-0 mt-1.5 list-disc pl-[18px] text-sm leading-[1.5] text-ink-2">
        {people.map((person) => (
          <li key={person}>{person}</li>
        ))}
      </ul>
    </div>
  );
}

/** What is the Quad Circle? Who is in it, how it works, and what keeps it kind and safe (spec 19 §5). */
export function CircleSection() {
  return (
    <section
      id="circle"
      aria-labelledby="circle-title"
      className="bg-[linear-gradient(180deg,var(--quad-canvas),var(--quad-wash-1)_45%,var(--quad-canvas))] py-24 max-[820px]:py-16"
    >
      <div className={wrap}>
        <SectionHead
          id="circle-title"
          eyebrow={t('public.circle.eyebrow')}
          title={t('public.circle.title', { accent: SLOT_MARKER })}
          accent={t('public.circle.titleAccent')}
          lede={t('public.circle.lede')}
        />
        <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-x-12 gap-y-8 max-[980px]:grid-cols-1">
          <figure className="m-0 w-full max-w-[640px] justify-self-center">
            <Painting viewBox="0 0 640 680" paint={circleDiagram} />
            {/* The diagram's text equivalent: visually hidden above 620 px, shown below (spec 19). */}
            <figcaption className="sr-only max-[620px]:not-sr-only max-[620px]:mt-1">
              <p className="m-0 mb-2 font-extrabold">
                {t('public.circle.people.title')}{' '}
                <span className="text-[13px] font-semibold text-ink-2">
                  {t('public.circle.people.sample')}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <PeopleGroup
                  title={t('public.circle.people.home')}
                  ring="border-c4"
                  people={HOME_PEOPLE.map((p) => t(`public.circle.people.${p}`))}
                />
                <PeopleGroup
                  title={t('public.circle.people.school')}
                  ring="border-c2"
                  people={SCHOOL_PEOPLE.map((p) => t(`public.circle.people.${p}`))}
                />
              </div>
            </figcaption>
          </figure>
          <div>
            <h3
              id="loop-title"
              className="m-0 mb-2.5 text-center text-[22px] leading-[1.25] font-extrabold tracking-[-.01em]"
            >
              {t('public.circle.loop.title')}
            </h3>
            <LoopArt>
              <ol
                aria-labelledby="loop-title"
                className="relative z-[1] m-0 grid list-none grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)] items-center p-0 max-[620px]:flex max-[620px]:flex-col max-[620px]:gap-[26px]"
              >
                {STEPS.map((key, i) => (
                  <li
                    key={key}
                    className={cn(
                      'relative flex flex-col items-center px-1 text-center',
                      STEP_PLACE[i],
                      NARROW_ITEM,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -top-1 font-accent text-[40px] leading-none font-semibold text-coral-ink italic [text-shadow:0_0_12px_var(--quad-canvas),0_0_4px_var(--quad-canvas)]',
                        i === 1 ? 'right-0.5' : 'left-0.5',
                        'max-[620px]:-top-3 max-[620px]:right-auto max-[620px]:-left-1 max-[620px]:text-[34px]',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span
                      data-loop-picture=""
                      className={cn(
                        'block w-full max-w-[232px] max-[620px]:row-span-2 max-[620px]:max-w-none',
                        i === 0 && 'order-3 max-[620px]:order-none',
                        i % 2 === 1 && 'max-[620px]:ml-3.5 max-[620px]:w-[calc(100%-14px)]',
                      )}
                    >
                      <Painting viewBox="0 0 160 110" paint={loopScenes[key]} />
                    </span>
                    <b
                      className={cn(
                        '-mt-1 block text-[16.5px] leading-[1.25] font-extrabold',
                        STEP_TEXT[i],
                        i === 0 && 'order-1 m-0 max-[620px]:order-none',
                        NARROW_TEXT,
                        'max-[620px]:m-0 max-[620px]:self-end',
                      )}
                    >
                      {t(`public.circle.loop.${key}.title`)}
                    </b>
                    <span
                      className={cn(
                        'mt-0.5 block max-w-[30ch] text-sm leading-[1.45] text-ink-2',
                        STEP_TEXT[i],
                        i === 0 && 'order-2 mb-0.5 max-[620px]:order-none',
                        NARROW_TEXT,
                        'max-[620px]:self-start',
                      )}
                    >
                      {t(`public.circle.loop.${key}.body`)}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="absolute top-1/2 left-1/2 z-[1] m-0 w-[100px] -translate-1/2 text-center font-accent text-[19px] leading-[1.15] font-medium text-coral-ink italic max-[620px]:static max-[620px]:mt-[18px] max-[620px]:w-auto max-[620px]:translate-none">
                {t('public.circle.loop.again1')}{' '}
                <span className="block max-[620px]:inline">{t('public.circle.loop.again2')}</span>
              </p>
            </LoopArt>
          </div>
        </div>
        <h3 className="m-0 mt-14 mb-[18px] text-[22px] leading-[1.25] font-extrabold tracking-[-.01em]">
          {t('public.circle.rules.title')}
        </h3>
        <ul className="m-0 grid list-none grid-cols-4 gap-4 p-0 max-[980px]:grid-cols-2 max-[620px]:grid-cols-1">
          {RULES.map((key) => (
            <li
              key={key}
              className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3 rounded-[18px] bg-surface/70 p-3.5"
            >
              <Painting viewBox="0 0 64 64" paint={ruleIcons[key]} className="size-14" />
              <div>
                <b className="block text-base leading-[1.3] font-extrabold">
                  {t(`public.circle.rules.${key}.title`)}
                </b>
                <span className="mt-[3px] block text-sm leading-[1.45] text-ink-2">
                  {t(`public.circle.rules.${key}.body`)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
