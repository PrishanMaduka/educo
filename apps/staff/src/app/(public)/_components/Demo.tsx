import { cn } from '@quad/ui';

import { FloatingDoodle } from '../_art/Doodle';
import { Face } from '../_art/Face';
import { site } from '../_art/people';
import { CONTACT_EMAIL } from '../_lib/site';

import { DemoForm, type DemoFormLabels } from './DemoForm';
import { display, onlyParent, onlySchool, wrap } from './styles';

import { SLOT_MARKER, t } from '@/i18n';

// Markers the browser replaces with the visitor's values (none of them occurs in a translation).
const MARKER = { slot: SLOT_MARKER, label: '⁣label⁣', value: '⁣value⁣' } as const;

function formLabels(variant: 'school' | 'parent'): DemoFormLabels {
  const isSchool = variant === 'school';
  return {
    name: t('public.demo.field.name'),
    email: isSchool ? t('public.demo.field.workEmail') : t('public.demo.field.email'),
    school: isSchool ? t('public.demo.field.school') : t('public.demo.field.childSchool'),
    place: isSchool ? t('public.demo.field.country') : t('public.demo.field.city'),
    students: t('public.demo.field.students'),
    curriculum: t('public.demo.field.curriculum'),
    note: t('public.demo.field.note'),
    noteInEmail: t('public.demo.mail.note'),
    notePlaceholder: t('public.demo.field.notePlaceholder'),
    studentsOptions: {
      under_300: t('public.demo.students.under_300'),
      '300_1000': t('public.demo.students.300_1000'),
      '1000_2500': t('public.demo.students.1000_2500'),
      over_2500: t('public.demo.students.over_2500'),
    },
    curriculumOptions: {
      ib: t('public.demo.curriculum.ib'),
      cambridge: t('public.demo.curriculum.cambridge'),
      edexcel: t('public.demo.curriculum.edexcel'),
      american: t('public.demo.curriculum.american'),
      national: t('public.demo.curriculum.national'),
      other: t('public.demo.curriculum.other'),
    },
    submit: t(`public.demo.${variant}.submit`),
    errors: {
      name_and_school: t(`public.demo.${variant}.error.name_and_school`),
      email: t(`public.demo.${variant}.error.email`),
      other: t('public.demo.error.other'),
    },
    privacy: t('public.demo.note'),
    sent: t('public.demo.sent'),
    fallback: t('public.demo.fallback', { email: MARKER.slot }),
    emailMarker: MARKER.slot,
    again: t('public.demo.again'),
    mail: {
      subject: t(`public.demo.${variant}.mail.subject`, { school: MARKER.slot }),
      intro: t(`public.demo.${variant}.mail.intro`),
      line: t('public.demo.mail.line', { label: MARKER.label, value: MARKER.value }),
      marker: MARKER,
    },
  };
}

const WAVERS = [
  { who: 'maya', size: 'size-[84px]', motion: '' },
  { who: 'okafor', size: 'size-16', motion: '[animation-duration:3.5s] [animation-delay:.3s]' },
  { who: 'priya', size: 'size-16', motion: '[animation-duration:4s] [animation-delay:.6s]' },
] as const;

/** The demo panel (spec 19): a demo for schools, or a note to your child's school for parents. */
export function Demo() {
  const title = cn(display, 'text-[clamp(42px,6vw,96px)] leading-[.9]');
  const lede = 'm-0 max-w-[28em] text-[19px] leading-[1.5]';
  const cheer = <Face who="maya" mood="laugh" />;
  return (
    <div id="demo" className="bg-site-page-bg text-site-page-ink">
      <div className={cn(wrap, 'pb-[clamp(56px,7vw,112px)]')}>
        <div className="relative flex flex-wrap items-start gap-x-[clamp(32px,5vw,72px)] gap-y-10 overflow-hidden rounded-[40px] bg-site-accent p-[clamp(28px,5vw,72px)] text-site-on-vivid">
          {/* The prototype's doodle layer is an empty flex item, so it also sets the copy's indent. */}
          <div aria-hidden="true">
            <FloatingDoodle
              kind="star"
              colour={site('navy')}
              left="95%"
              top="4%"
              size={26}
              motion="motion-safe:animate-twinkle"
            />
            <FloatingDoodle
              kind="plane"
              colour={site('white')}
              left="30%"
              top="86%"
              size={40}
              motion="motion-safe:animate-drift"
            />
            <FloatingDoodle
              kind="heart"
              colour={site('navy')}
              left="42%"
              top="92%"
              size={20}
              motion="motion-safe:animate-twinkle [animation-duration:2.6s] [animation-delay:.5s]"
            />
            <FloatingDoodle
              kind="squiggle"
              colour={site('navy')}
              left="2%"
              top="95%"
              size={36}
              motion="motion-safe:animate-drift [animation-duration:9s]"
            />
          </div>
          <div className="relative flex flex-[1_1_380px] flex-col gap-[22px]">
            <h2 id="demo-title" className={title}>
              <span className={onlySchool}>{t('public.demo.school.title')}</span>
              <span className={onlyParent}>{t('public.demo.parent.title')}</span>
            </h2>
            <p className={cn(lede, onlySchool)}>{t('public.demo.school.lede')}</p>
            <p className={cn(lede, onlyParent)}>{t('public.demo.parent.lede')}</p>
            <div aria-hidden="true" className="flex items-end gap-2.5">
              {WAVERS.map(({ who, size, motion }, i) => (
                <div
                  key={who}
                  className={cn(size, 'motion-safe:animate-bob [animation-duration:3s]', motion)}
                >
                  <Face who={who} mood={i === 0 ? 'laugh' : 'happy'} bg={site('navy')} />
                </div>
              ))}
            </div>
          </div>
          <div className="relative max-w-[560px] flex-[1.15_1_440px] rounded-[28px] bg-site-navy p-[clamp(22px,3vw,32px)] text-site-on-navy">
            <div className={onlySchool}>
              <DemoForm
                variant="school"
                to={CONTACT_EMAIL}
                labels={formLabels('school')}
                cheer={cheer}
              />
            </div>
            <div className={onlyParent}>
              <DemoForm
                variant="parent"
                to={CONTACT_EMAIL}
                labels={formLabels('parent')}
                cheer={cheer}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
