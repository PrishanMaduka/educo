import { TURNSTILE_DUMMY_TOKEN } from '@quad/contracts';
import { cn } from '@quad/ui';

import { FloatingDoodle } from '../_art/Doodle';
import { Face } from '../_art/Face';
import { site } from '../_art/people';
import { CONTACT_EMAIL } from '../_lib/site';

import { AppBadges } from './AppBadges';
import {
  DemoForm,
  type AroundEmail,
  type DemoFormDelivery,
  type DemoFormLabels,
  type DemoSendLabels,
} from './DemoForm';
import { display, onlyParent, onlySchool, wrap } from './styles';

import { SLOT_MARKER, splitAround, t } from '@/i18n';
import { publicEnv } from '@/lib/public-env';

// Markers the browser replaces with the visitor's values (none of them occurs in a translation).
const MARKER = { slot: SLOT_MARKER, label: '⁣label⁣', value: '⁣value⁣' } as const;

/**
 * A message split around the support address, which the form turns into the email fallback link.
 * A translation without the address gets the link after it.
 */
function aroundEmail(message: string): AroundEmail {
  if (!message.includes(CONTACT_EMAIL)) return { before: `${message} `, after: '' };
  const [before, after] = splitAround(message, CONTACT_EMAIL);
  return { before, after };
}

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

/** The endpoint form's own copy (D57), sent to the browser only when the form sends to Quad. */
function sendLabels(variant: 'school' | 'parent'): DemoSendLabels {
  const [noteBefore, noteAfter] = splitAround(
    t('public.demo.noteProtected', { link: SLOT_MARKER }),
    SLOT_MARKER,
  );
  return {
    sending: t('public.demo.sending'),
    thanks: variant === 'school' ? t('public.demo.thanks') : t('public.demo.thanksParent'),
    captchaFailed: t('error.captchaFailed'),
    rateLimited: aroundEmail(t('public.demo.error.rateLimited')),
    unavailable: aroundEmail(t('error.captchaUnavailable')),
    honeypot: t('public.demo.field.website'),
    protectedNote: { before: noteBefore, link: t('public.demo.privacyLink'), after: noteAfter },
  };
}

const WAVERS = [
  { who: 'maya', size: 'size-[84px]', motion: '' },
  { who: 'okafor', size: 'size-16', motion: '[animation-duration:3.5s] [animation-delay:.3s]' },
  { who: 'priya', size: 'size-16', motion: '[animation-duration:4s] [animation-delay:.6s]' },
] as const;

/**
 * How the forms send (D57): before launch an email (D30); after, Quad's endpoint with Turnstile.
 * A local build without a site key sends the dummy token the local verifier accepts; elsewhere
 * the build already refused to run without one (`parseWebPublicEnv`).
 */
function delivery(prelaunch: boolean, variant: 'school' | 'parent'): DemoFormDelivery {
  if (prelaunch) return { mode: 'mailto' };
  const siteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (siteKey === undefined && publicEnv.NEXT_PUBLIC_APP_ENV !== 'local') {
    throw new Error('NEXT_PUBLIC_TURNSTILE_SITE_KEY is required outside local (D57).');
  }
  return {
    mode: 'endpoint',
    turnstile: siteKey === undefined ? { dummyToken: TURNSTILE_DUMMY_TOKEN } : { siteKey },
    sendLabels: sendLabels(variant),
  };
}

/** The demo panel (spec 19): a demo for schools, or a note to your child's school for parents. */
export function Demo({ prelaunch }: { prelaunch: boolean }) {
  const title = cn(display, 'text-[clamp(42px,6vw,96px)] leading-[.9]');
  const lede = 'm-0 max-w-[28em] text-[19px] leading-[1.5]';
  const cheer = <Face who="maya" mood="laugh" />;
  return (
    <div id="demo" className="bg-site-page-bg text-site-page-ink">
      <div className={cn(wrap, 'pb-[clamp(56px,7vw,112px)]')}>
        <div className="relative flex flex-wrap items-start gap-x-[clamp(32px,5vw,72px)] gap-y-10 overflow-hidden rounded-[40px] bg-site-accent p-[clamp(28px,5vw,72px)] text-site-on-vivid">
          {/* The prototype's doodle layer is an empty flex item, so it also sets the copy's indent.
              Below 760 px only the first doodle stays, clear of the copy. */}
          <div aria-hidden="true" className="max-[760px]:[&>:not(:first-child)]:hidden">
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
            <div className={cn('flex flex-col gap-2.5', onlyParent)}>
              <p className="m-0 text-base font-bold">{t('public.demo.parent.app')}</p>
              <AppBadges tone="demo" />
            </div>
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
                {...delivery(prelaunch, 'school')}
              />
            </div>
            <div className={onlyParent}>
              <DemoForm
                variant="parent"
                to={CONTACT_EMAIL}
                labels={formLabels('parent')}
                cheer={cheer}
                {...delivery(prelaunch, 'parent')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
