import { cn } from '@quad/ui';
import { ArrowDown } from 'lucide-react';

import { AMAYA_AT, HERO_VIEWBOX, heroScene, KITE_AT, kiteIcon } from '../_illustrations/hero';
import { Painting } from '../_illustrations/Painting';

import { Accented } from './Accented';
import { HeroLive, type HeroEvent } from './HeroLive';
import { SignInEntry, type ComingSoonLabels } from './SignInEntry';
import { button, eyebrow, lede, wrap } from './styles';

import type { CirclePerson } from '../_illustrations/people';

import { SLOT_MARKER, t } from '@/i18n';

/** The six sample events the ticker cycles through: who sends, who receives, and the message key. */
const FEED = [
  ['jaya', 'dilhani', 'jayaMoment'],
  ['dilhani', 'jaya', 'mumThanks'],
  ['perera', 'ruwan', 'pereraLearning'],
  ['kamala', 'jaya', 'grandmaLoves'],
  ['herath', 'ruwan', 'coachMoment'],
  ['dilhani', 'perera', 'triedAtHome'],
] as const satisfies readonly (readonly [CirclePerson, CirclePerson, string])[];

const VIEWBOX = `0 0 ${HERO_VIEWBOX.width} ${HERO_VIEWBOX.height}`;

function heroEvents(): HeroEvent[] {
  return FEED.map(([from, to, key]) => ({
    from: KITE_AT[from] ?? AMAYA_AT,
    to: KITE_AT[to] ?? AMAYA_AT,
    title: t(`public.hero.feed.${key}.title`),
    detail: t(`public.hero.feed.${key}.detail`),
    icon: (
      <svg
        viewBox="-30 -40 60 84"
        aria-hidden="true"
        focusable="false"
        className="-mt-2 block h-[58px] w-[42px]"
        dangerouslySetInnerHTML={{ __html: kiteIcon(from) }}
      />
    ),
  }));
}

/** Hero (spec 19 §2–3): the promise, the actions, and Amaya's circle as kites. */
export function Hero({
  prelaunch,
  comingSoon,
}: {
  prelaunch: boolean;
  comingSoon: ComingSoonLabels;
}) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative bg-[radial-gradient(640px_420px_at_6%_8%,var(--quad-wash-1),transparent_70%),radial-gradient(760px_560px_at_86%_42%,var(--quad-wash-2),transparent_70%)] pt-12 pb-10 max-[900px]:pt-2 max-[900px]:pb-4"
    >
      <div
        className={cn(
          wrap,
          'grid grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] items-center gap-8 max-[900px]:grid-cols-1',
        )}
      >
        <div>
          <p className={cn('m-0', eyebrow)}>{t('public.hero.eyebrow')}</p>
          <h1
            id="hero-title"
            className="m-0 mt-4 text-[clamp(44px,7vw,82px)] leading-[.98] font-black tracking-[-.04em] text-balance"
          >
            <Accented
              template={t('public.hero.title', { accent: SLOT_MARKER })}
              accent={t('public.hero.titleAccent')}
              className="font-accent font-semibold tracking-[-.03em] text-coral-ink italic"
            />
          </h1>
          <p className={cn(lede, 'mt-[22px]')}>{t('public.hero.lede')}</p>
          <div className="mt-[30px] flex flex-wrap gap-3">
            <a href="#demo" className={button()}>
              {t('public.bookDemo')}
            </a>
            <a href="#day" className={button({ variant: 'ghost' })}>
              {t('public.hero.seeDay')}
              <ArrowDown aria-hidden="true" strokeWidth={2.4} className="size-[18px]" />
            </a>
          </div>
          {/* A div: before launch the entry carries its note, a <dialog> with its own paragraphs. */}
          <div className="mt-4 text-[14.5px] text-ink-2">
            {t('public.hero.already')}{' '}
            <SignInEntry
              label={t('public.hero.signIn')}
              look="link"
              prelaunch={prelaunch}
              comingSoon={comingSoon}
            />
          </div>
          <ul className="m-0 mt-3.5 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[13.5px] text-ink-2">
            {[t('public.hero.fine.curricula'), t('public.hero.fine.local')].map((point) => (
              <li key={point} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block size-[7px] rounded-full bg-c5" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto flex w-full max-w-[680px] flex-col items-center gap-1.5 max-[900px]:order-first max-[900px]:-mx-4 max-[900px]:w-[calc(100%+32px)] max-[900px]:max-w-none">
          <HeroLive
            viewBox={VIEWBOX}
            via={AMAYA_AT}
            events={heroEvents()}
            painting={
              <Painting
                viewBox={VIEWBOX}
                paint={heroScene}
                title={{ id: 'hero-scene-title', text: t('public.hero.scene') }}
              />
            }
          />
          <p className="m-0 text-[12.5px] font-bold text-ink-2">{t('public.hero.sample')}</p>
        </div>
      </div>
    </section>
  );
}
