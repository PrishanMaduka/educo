import { cn } from '@quad/ui';

import { Doodle, type DoodleKind } from '../_art/Doodle';
import { site } from '../_art/people';

import { display, onlyParent, onlySchool, wrap } from './styles';
import { TypedAnswer } from './TypedAnswer';

import type { ReactNode } from 'react';

import { SLOT_MARKER, splitAround, t } from '@/i18n';

const MODULES = [
  { key: 'admissions', icon: 'plane', colour: 'sky' },
  { key: 'students', icon: 'star', colour: 'orange' },
  { key: 'attendance', icon: 'sun', colour: 'orange' },
  { key: 'timetable', icon: 'pencil', colour: 'sky' },
  { key: 'exams', icon: 'book', colour: 'lime' },
  { key: 'pastoral', icon: 'heart', colour: 'pink' },
  { key: 'fees', icon: 'coin', colour: 'lime' },
  { key: 'communication', icon: 'bubble', colour: 'pink' },
] as const satisfies readonly { key: string; icon: DoodleKind; colour: string }[];

const DAY = [
  { key: 'arrive', icon: 'sun', colour: 'orange' },
  { key: 'moment', icon: 'star', colour: 'sky' },
  { key: 'family', icon: 'heart', colour: 'pink' },
  { key: 'people', icon: 'kite', colour: 'lime' },
  { key: 'try', icon: 'pencil', colour: 'orange' },
  { key: 'quiet', icon: 'moon', colour: 'sky' },
] as const satisfies readonly { key: string; icon: DoodleKind; colour: string }[];

const SAFE = [
  { key: 'family', mark: '4', colour: 'pink' },
  { key: 'photos', mark: '◐', colour: 'sky' },
  { key: 'quiet', mark: '☾', colour: 'orange' },
  { key: 'records', mark: '✓', colour: 'lime' },
] as const;

const cardList =
  'm-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] gap-3.5 p-0';
const card =
  'flex min-h-[190px] flex-col gap-2.5 rounded-3xl border border-site-card-line bg-site-card-bg p-[22px] transition-transform duration-300 ease-[cubic-bezier(.3,1.5,.5,1)] hover:-translate-y-1.5 hover:rotate-1 motion-reduce:transition-none motion-reduce:hover:transform-none';
const head = 'mb-12 flex flex-wrap items-end justify-between gap-x-16 gap-y-5';
const headTitle = cn(display, 'flex-[1_1_460px] text-[clamp(40px,5.4vw,84px)] leading-[.92]');
const headLede = 'm-0 max-w-[28em] flex-[1_1_300px] text-lg leading-[1.5] text-site-page-ink-2';

function Icon({
  kind,
  colour,
  small = false,
}: {
  kind: DoodleKind;
  colour: string;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid place-items-center bg-(--c)',
        small ? 'size-[50px] rounded-2xl' : 'size-[58px] rounded-[18px]',
      )}
      style={{ '--c': site(colour) }}
    >
      <Doodle kind={kind} className={small ? 'size-[26px]' : 'size-[30px]'} />
    </span>
  );
}

function Feature({
  kicker,
  title,
  colour,
  children,
}: {
  kicker: string;
  title: string;
  colour: string;
  children: ReactNode;
}) {
  return (
    <li
      className="flex min-h-[280px] flex-col gap-3.5 rounded-[28px] bg-(--c) p-[26px] text-site-on-vivid"
      style={{ '--c': site(colour) }}
    >
      <span className="text-sm font-bold">{kicker}</span>
      <strong className="text-[28px] leading-[1.05] tracking-[-.03em]">{title}</strong>
      {children}
    </li>
  );
}

/** Everything a school runs (schools), or the family's day (parents), then "Kind and safe" (spec 19). */
export function More() {
  const [sayBefore, sayAfter] = splitAround(
    t('public.more.story.say', { count: SLOT_MARKER }),
    SLOT_MARKER,
  );
  return (
    <div id="more" className="bg-site-page-bg text-site-page-ink">
      <div className={cn(wrap, 'py-[clamp(64px,8vw,120px)]')}>
        <section aria-labelledby="more-school" className={onlySchool}>
          <div className={head}>
            <h2 id="more-school" className={headTitle}>
              {t('public.more.school.title')}
            </h2>
            <p className={headLede}>{t('public.more.school.lede')}</p>
          </div>
          <ul className={cardList}>
            {MODULES.map(({ key, icon, colour }) => (
              <li key={key} className={card}>
                <Icon kind={icon} colour={colour} />
                <strong className="mt-auto text-[21px] tracking-[-.02em]">
                  {t(`public.more.modules.${key}.title`)}
                </strong>
                <span className="text-sm leading-[1.45] text-site-page-ink-2">
                  {t(`public.more.modules.${key}.body`)}
                </span>
              </li>
            ))}
          </ul>
          <ul className="m-0 mt-3.5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3.5 p-0">
            <Feature
              kicker={t('public.more.story.kicker')}
              title={t('public.more.story.title')}
              colour="sky"
            >
              <p className="m-0 mt-auto rounded-[18px] bg-site-white p-4 text-[15px] leading-[1.45]">
                {sayBefore}
                <strong>{t('public.more.story.count')}</strong>
                {sayAfter}
              </p>
            </Feature>
            <Feature
              kicker={t('public.more.ask.kicker')}
              title={t('public.more.ask.title')}
              colour="orange"
            >
              <div className="mt-auto flex flex-col gap-2">
                <p className="m-0 self-end rounded-[16px_16px_4px_16px] bg-site-navy px-3.5 py-2.5 text-sm text-site-white">
                  {t('public.more.ask.question')}
                </p>
                <p className="m-0 min-h-[2.6em] self-start rounded-[16px_16px_16px_4px] bg-site-white px-3.5 py-2.5 text-sm leading-[1.4]">
                  <TypedAnswer answer={t('public.more.ask.answer')} />
                </p>
              </div>
            </Feature>
            <Feature
              kicker={t('public.more.brand.kicker')}
              title={t('public.more.brand.title')}
              colour="lime"
            >
              <div className="mt-auto flex gap-2.5">
                {(
                  [
                    ['greenfield', 'bg-site-school-green', ''],
                    ['stClare', 'bg-site-school-maroon', '[animation-delay:1.2s]'],
                  ] as const
                ).map(([key, colour, delay]) => (
                  <div
                    key={key}
                    className={cn(
                      'flex min-h-[84px] flex-1 flex-col justify-between rounded-[18px] p-3.5 text-[13px] font-bold text-site-white motion-safe:animate-bob',
                      colour,
                      delay,
                    )}
                  >
                    <b aria-hidden="true" className="text-[22px]">
                      {t(`public.more.brand.${key}.initial`)}
                    </b>
                    {t(`public.more.brand.${key}.name`)}
                  </div>
                ))}
              </div>
            </Feature>
          </ul>
        </section>
        <section aria-labelledby="more-parent" className={onlyParent}>
          <div className={head}>
            <h2 id="more-parent" className={headTitle}>
              {t('public.more.parent.title')}
            </h2>
            <p className={headLede}>{t('public.more.parent.lede')}</p>
          </div>
          <ul className={cardList}>
            {DAY.map(({ key, icon, colour }) => (
              <li key={key} className={card}>
                <div className="flex items-center justify-between">
                  <b className="text-[30px] font-extrabold tracking-[-.03em]">
                    {t(`public.more.day.${key}.time`)}
                  </b>
                  <Icon kind={icon} colour={colour} small />
                </div>
                <small className="mt-auto text-[13px] font-bold text-site-page-ink-3">
                  {t(`public.more.day.${key}.kicker`)}
                </small>
                <strong className="text-[21px] leading-[1.15] tracking-[-.02em]">
                  {t(`public.more.day.${key}.title`)}
                </strong>
                <span className="text-sm leading-[1.45] text-site-page-ink-2">
                  {t(`public.more.day.${key}.body`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section
          aria-labelledby="safe-title"
          className="mt-[clamp(56px,7vw,96px)] rounded-[32px] border border-site-band-edge bg-site-band-bg p-[clamp(26px,4vw,48px)] text-site-on-navy"
        >
          <h2
            id="safe-title"
            className="m-0 mb-6 text-[clamp(28px,3vw,40px)] font-extrabold tracking-[-.03em] text-balance"
          >
            <span className={onlySchool}>{t('public.safe.school.title')}</span>
            <span className={onlyParent}>{t('public.safe.parent.title')}</span>
          </h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-x-8 gap-y-6 p-0">
            {SAFE.map(({ key, mark, colour }) => (
              <li key={key} className="flex flex-col gap-2">
                <span
                  aria-hidden="true"
                  className="grid size-11 place-items-center rounded-[14px] bg-(--c) text-xl font-extrabold text-site-on-vivid"
                  style={{ '--c': site(colour) }}
                >
                  {mark}
                </span>
                <strong className="text-lg">{t(`public.safe.${key}.title`)}</strong>
                <span className="text-[15px] leading-[1.5] text-site-on-navy-2">
                  {t(`public.safe.${key}.body`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
