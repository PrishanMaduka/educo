import { cn } from '@quad/ui';

import { Doodle, FloatingDoodle } from '../_art/Doodle';
import { Face } from '../_art/Face';
import { PEOPLE, ROLE_COLOUR, site, type PersonId } from '../_art/people';

import { HeroStage, type StageAvatar, type StageMessage } from './HeroStage';
import { Highlighted } from './Highlighted';
import { SignInEntry, type ComingSoonLabels } from './SignInEntry';
import { button, display, onlyParent, onlySchool, wrap } from './styles';

import { SLOT_MARKER, t } from '@/i18n';

/** Maya's circle around the phone: position in percent of the stage, and nearer the phone below 560 px. */
const AVATARS = [
  { who: 'okafor', x: 6, y: 14, xPhone: 13 },
  { who: 'tanaka', x: 3, y: 50, xPhone: 12 },
  { who: 'haddad', x: 9, y: 86, xPhone: 14 },
  { who: 'priya', x: 94, y: 14, xPhone: 87 },
  { who: 'asha', x: 97, y: 50, xPhone: 88 },
  { who: 'daniel', x: 91, y: 86, xPhone: 86 },
] as const satisfies readonly { who: PersonId; x: number; y: number; xPhone: number }[];

/** The six moments of Maya's day, in order: who, the message, and whether a star or a heart flies. */
const MESSAGES = [
  { key: 'okaforMoment', who: 'okafor', token: 'star', thanks: true },
  { key: 'priyaThanks', who: 'priya', token: 'heart', thanks: false },
  { key: 'ashaLoved', who: 'asha', token: 'heart', thanks: false },
  { key: 'haddadCheck', who: 'haddad', token: 'star', thanks: false },
  { key: 'tanakaMoment', who: 'tanaka', token: 'star', thanks: true },
  { key: 'danielTried', who: 'daniel', token: 'heart', thanks: false },
] as const;

/** The name a message shows: the first name for family ("Priya", not "Priya, Mum"). */
const SHORT_NAME: Partial<
  Record<PersonId, 'public.people.priya.short' | 'public.people.daniel.short'>
> = {
  priya: 'public.people.priya.short',
  daniel: 'public.people.daniel.short',
};

function stageAvatars(): StageAvatar[] {
  return AVATARS.map((avatar) => ({
    ...avatar,
    name: t(`public.people.${avatar.who}`),
    colour: ROLE_COLOUR[PEOPLE[avatar.who].role],
    face: <Face who={avatar.who} />,
  }));
}

function stageMessages(): StageMessage[] {
  return MESSAGES.map(({ key, who, token, thanks }) => {
    const shortKey = SHORT_NAME[who];
    const name = shortKey ? t(shortKey) : t(`public.people.${who}`);
    const verb = t(`public.hero.feed.${key}.verb`);
    const text = t(`public.hero.feed.${key}.text`);
    return {
      who,
      name,
      verb,
      text,
      time: t(`public.hero.feed.${key}.time`),
      action: thanks ? t('public.hero.feed.thankYou') : undefined,
      live: t('public.hero.feed.live', { name, verb, text }),
      face: <Face who={who} />,
      token: (
        <Doodle
          kind={token}
          colour={site(token === 'heart' ? 'pink' : 'lime')}
          className="size-full"
        />
      ),
      colour: ROLE_COLOUR[PEOPLE[who].role],
    };
  });
}

/** Hero (spec 19 §2): the promise for each view, the actions, and Maya's day on a phone. */
export function Hero({
  prelaunch,
  comingSoon,
}: {
  prelaunch: boolean;
  comingSoon: ComingSoonLabels;
}) {
  const stat = (key: 'app' | 'relatives' | 'quiet') => (
    <div key={key}>
      <b className="block text-[28px] leading-[1.2] font-extrabold tracking-[-.03em]">
        {t(`public.hero.stats.${key}.value`)}
      </b>
      <span className="text-sm text-site-on-navy-3">{t(`public.hero.stats.${key}.label`)}</span>
    </div>
  );
  const lede =
    'm-0 max-w-[30em] text-[clamp(18px,1.5vw,21px)] leading-[1.5] text-pretty text-site-on-navy-2';
  return (
    <section aria-labelledby="hero-title" className="relative">
      <div
        className={cn(
          wrap,
          'flex flex-wrap items-center gap-x-[clamp(32px,5vw,72px)] gap-y-14 pt-[clamp(28px,4vw,56px)] pb-[clamp(56px,7vw,96px)]',
        )}
      >
        <div className="relative z-[2] flex min-w-0 flex-[1.15_1_440px] flex-col gap-7">
          <p className="m-0 flex items-center gap-2 self-start rounded-full bg-site-navy-2 py-[7px] pr-3.5 pl-2 text-sm font-semibold text-site-lime">
            <span
              aria-hidden="true"
              className="grid size-[22px] place-items-center rounded-full bg-site-lime text-xs font-extrabold text-site-on-vivid"
            >
              ✦
            </span>
            <span className={onlySchool}>{t('public.hero.school.kicker')}</span>
            <span className={onlyParent}>{t('public.hero.parent.kicker')}</span>
          </p>
          <h1
            id="hero-title"
            className={cn(display, 'text-[clamp(54px,7.6vw,118px)] leading-[.9]')}
          >
            <span className={onlySchool}>
              <Highlighted
                template={t('public.hero.school.title', { accent: SLOT_MARKER })}
                accent={t('public.hero.school.titleAccent')}
              />
            </span>
            <span className={onlyParent}>
              <Highlighted
                template={t('public.hero.parent.title', { accent: SLOT_MARKER })}
                accent={t('public.hero.parent.titleAccent')}
              />
            </span>
          </h1>
          <p className={cn(lede, onlySchool)}>{t('public.hero.school.lede')}</p>
          <p className={cn(lede, onlyParent)}>{t('public.hero.parent.lede')}</p>
          <div className="flex flex-wrap gap-3">
            <a href="#demo" className={button()}>
              <span className={onlySchool}>{t('public.cta.school')}</span>
              <span className={onlyParent}>{t('public.hero.parent.cta')}</span>
              <span aria-hidden="true">→</span>
            </a>
            <a href="#circle" className={button({ variant: 'line' })}>
              {t('public.hero.howItWorks')}
            </a>
          </div>
          <div className={cn('text-[15px] text-site-on-navy-2', onlySchool)}>
            {t('public.hero.already')}{' '}
            <SignInEntry
              label={t('public.hero.signIn')}
              look="link"
              prelaunch={prelaunch}
              comingSoon={comingSoon}
            />
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-4 pt-1.5">
            {stat('app')}
            {stat('relatives')}
            {stat('quiet')}
          </div>
        </div>
        <HeroStage
          label={t('public.hero.stage')}
          phone={{
            initial: t('public.hero.phone.schoolInitial'),
            school: [t('public.hero.phone.schoolLine1'), t('public.hero.phone.schoolLine2')],
            title: t('public.hero.phone.title'),
            detail: t('public.hero.phone.detail'),
            maya: <Face who="maya" mood="laugh" />,
          }}
          avatars={stageAvatars()}
          messages={stageMessages()}
          decorations={
            <>
              <FloatingDoodle
                kind="star"
                colour={site('lime')}
                left="22%"
                top="-2%"
                size={30}
                motion="motion-safe:animate-twinkle"
              />
              <FloatingDoodle
                kind="kite"
                colour={site('orange')}
                left="74%"
                top="-6%"
                size={46}
                motion="motion-safe:animate-drift"
              />
              <FloatingDoodle
                kind="cloud"
                colour={site('navy-line')}
                left="-8%"
                top="30%"
                size={54}
                motion="motion-safe:animate-drift [animation-duration:11s]"
              />
              <FloatingDoodle
                kind="heart"
                colour={site('pink')}
                left="96%"
                top="32%"
                size={24}
                motion="motion-safe:animate-twinkle [animation-duration:2.6s] [animation-delay:.8s]"
              />
              <FloatingDoodle
                kind="pencil"
                colour={site('sky')}
                left="78%"
                top="93%"
                size={38}
                motion="motion-safe:animate-drift [animation-duration:8s] [animation-delay:1s]"
              />
              <FloatingDoodle
                kind="star"
                colour={site('orange')}
                left="18%"
                top="96%"
                size={22}
                motion="motion-safe:animate-twinkle [animation-duration:3.4s] [animation-delay:.4s]"
              />
            </>
          }
        />
      </div>
    </section>
  );
}
