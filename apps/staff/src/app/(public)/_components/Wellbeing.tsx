import { cn } from '@quad/ui';

import { FloatingDoodle } from '../_art/Doodle';
import { Face } from '../_art/Face';
import { site } from '../_art/people';
import { Plant } from '../_art/Plant';

import { LeoCard } from './LeoCard';
import { display, onlyParent, onlySchool, wrap } from './styles';

import { SLOT_MARKER, splitAround, t } from '@/i18n';

const bandWrap = cn(
  wrap,
  'relative flex flex-wrap items-center gap-x-[clamp(40px,6vw,96px)] gap-y-12 py-[clamp(64px,8vw,120px)]',
);
const copy = 'flex flex-[1.2_1_420px] flex-col gap-[22px]';
const title = cn(display, 'text-[clamp(40px,5.2vw,80px)] leading-[.92]');
const body = 'm-0 max-w-[30em] text-lg leading-[1.55] text-site-on-navy-2';
const tag = 'm-0 self-start rounded-full px-3.5 py-1.5 text-sm font-bold text-site-on-vivid';

const CHIPS = [
  { key: 'curiosity', className: 'bg-site-chip-sky-bg text-site-chip-sky-ink' },
  { key: 'kindness', className: 'bg-site-chip-pink-bg text-site-chip-pink-ink' },
  { key: 'persistence', className: 'bg-site-chip-orange-bg text-site-chip-orange-ink' },
] as const;

/**
 * The navy band (spec 19): "Wellbeing, early" with Leo's card for schools, and the weekly recap
 * with Maya's plant for parents.
 */
export function Wellbeing() {
  const [ideaBefore, ideaAfter] = splitAround(
    t('public.wellbeing.week.idea', { lead: SLOT_MARKER }),
    SLOT_MARKER,
  );
  return (
    <div
      id="wellbeing"
      className="relative overflow-hidden border-y border-site-band-edge bg-site-band-bg text-site-on-navy"
    >
      <FloatingDoodle
        kind="star"
        colour={site('lime')}
        left="6%"
        top="12%"
        size={26}
        motion="motion-safe:animate-twinkle"
      />
      <FloatingDoodle
        kind="kite"
        colour={site('pink')}
        left="88%"
        top="10%"
        size={50}
        motion="motion-safe:animate-drift [animation-duration:8s]"
      />
      <FloatingDoodle
        kind="cloud"
        colour={site('navy-2')}
        left="70%"
        top="78%"
        size={90}
        motion="motion-safe:animate-drift [animation-duration:12s]"
      />
      <FloatingDoodle
        kind="star"
        colour={site('orange')}
        left="46%"
        top="86%"
        size={20}
        motion="motion-safe:animate-twinkle [animation-duration:2.4s] [animation-delay:.6s]"
      />
      <section aria-labelledby="wellbeing-school" className={cn(bandWrap, onlySchool)}>
        <div className={copy}>
          <p className={cn(tag, 'bg-site-pink')}>{t('public.wellbeing.school.tag')}</p>
          <h2 id="wellbeing-school" className={title}>
            {t('public.wellbeing.school.title')}
          </h2>
          <p className={body}>{t('public.wellbeing.school.body')}</p>
        </div>
        <LeoCard
          text={{
            name: t('public.people.leo'),
            detail: t('public.wellbeing.leo.detail'),
            tagBefore: t('public.wellbeing.leo.tagBefore'),
            tagAfter: t('public.wellbeing.leo.tagAfter'),
            textBefore: t('public.wellbeing.leo.textBefore'),
            textAfter: t('public.wellbeing.leo.textAfter'),
            teacher: t('public.people.abara'),
            teacherRole: t('public.wellbeing.leo.teacherRole'),
            start: t('public.wellbeing.leo.start'),
            replay: t('public.wellbeing.leo.replay'),
          }}
          faces={{
            worried: <Face who="leo" mood="worried" bg={site('tag-bad-bg')} />,
            happy: <Face who="leo" mood="laugh" bg={site('lime')} />,
            teacher: <Face who="abara" />,
          }}
        />
      </section>
      <section aria-labelledby="wellbeing-parent" className={cn(bandWrap, onlyParent)}>
        <div className={copy}>
          <p className={cn(tag, 'bg-site-lime')}>{t('public.wellbeing.parent.tag')}</p>
          <h2 id="wellbeing-parent" className={title}>
            {t('public.wellbeing.parent.title')}
          </h2>
          <p className={body}>{t('public.wellbeing.parent.body')}</p>
          <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
            {(['moments', 'days', 'tried'] as const).map((key) => (
              <li key={key} className="rounded-[14px] bg-site-navy-2 px-4 py-3">
                <strong className="block text-[26px] tracking-[-.03em]">
                  {t(`public.wellbeing.recap.${key}.value`)}
                </strong>
                <small className="text-[13px] text-site-on-navy-2">
                  {t(`public.wellbeing.recap.${key}.label`)}
                </small>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex max-w-[500px] flex-[1_1_360px] flex-col gap-4 rounded-[32px] bg-site-sheet-bg p-[clamp(22px,3vw,32px)] text-site-sheet-ink shadow-[0_30px_70px_var(--quad-site-card-shadow)]">
          <div className="flex items-center justify-between">
            <strong className="text-[22px] tracking-[-.02em]">
              {t('public.wellbeing.week.title')}
            </strong>
            <span className="rounded-full bg-site-orange px-3 py-1 text-[13px] font-bold text-site-on-vivid">
              {t('public.wellbeing.week.day')}
            </span>
          </div>
          <div className="flex h-[260px] justify-center">
            <Plant label={t('public.wellbeing.week.plant')} pot={t('public.wellbeing.week.pot')} />
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {CHIPS.map(({ key, className }) => (
              <li
                key={key}
                className={cn('rounded-full px-3 py-[5px] text-[13px] font-semibold', className)}
              >
                {t(`public.wellbeing.week.${key}`)}
              </li>
            ))}
          </ul>
          <p className="m-0 rounded-2xl bg-site-lime px-3.5 py-3 text-[15px] leading-[1.4] text-site-on-vivid">
            {ideaBefore}
            <strong>{t('public.wellbeing.week.ideaLead')}</strong>
            {ideaAfter}
          </p>
        </div>
      </section>
    </div>
  );
}
