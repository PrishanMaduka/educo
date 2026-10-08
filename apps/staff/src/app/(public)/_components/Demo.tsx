import { cn } from '@quad/ui';

import { Painting } from '../_illustrations/Painting';
import { teaScene } from '../_illustrations/sections';
import { CONTACT_EMAIL } from '../_lib/site';

import { Accented } from './Accented';
import { DemoForm, type DemoFormLabels } from './DemoForm';
import { eyebrow, h2, lede, wrap } from './styles';

import type { DemoCurriculum, StudentsBand } from '@quad/contracts/public';

import { SLOT_MARKER, t } from '@/i18n';

// Markers the browser replaces with the visitor's values (none of them occurs in a translation).
const MARKER = { slot: SLOT_MARKER, label: '⁣label⁣', value: '⁣value⁣' } as const;

function formLabels(): DemoFormLabels {
  const fields = {
    name: t('public.demo.field.name'),
    email: t('public.demo.field.email'),
    school: t('public.demo.field.school'),
    country: t('public.demo.field.country'),
    students: t('public.demo.field.students'),
    curriculum: t('public.demo.field.curriculum'),
  };
  const students: Record<StudentsBand, string> = {
    under_300: t('public.demo.students.under_300'),
    '300_1000': t('public.demo.students.300_1000'),
    '1000_2500': t('public.demo.students.1000_2500'),
    over_2500: t('public.demo.students.over_2500'),
  };
  const curricula: Record<DemoCurriculum, string> = {
    cambridge: t('public.demo.curriculum.cambridge'),
    edexcel: t('public.demo.curriculum.edexcel'),
    ib: t('public.demo.curriculum.ib'),
    sri_lankan_national: t('public.demo.curriculum.sri_lankan_national'),
    other: t('public.demo.curriculum.other'),
  };
  return {
    fields,
    students,
    curricula,
    submit: t('public.demo.submit'),
    errors: {
      name_and_school: t('public.demo.error.name_and_school'),
      work_email: t('public.demo.error.work_email'),
      choice: t('public.demo.error.choice'),
    },
    note: t('public.demo.note'),
    sent: t('public.demo.sent'),
    fallback: t('public.demo.fallback', { email: MARKER.slot }),
    emailMarker: MARKER.slot,
    mail: {
      subject: t('public.demo.mail.subject', { school: MARKER.slot }),
      intro: t('public.demo.mail.intro'),
      line: t('public.demo.mail.line', { label: MARKER.label, value: MARKER.value }),
      fields,
      students,
      curricula,
      marker: MARKER,
    },
  };
}

/** Book a 30-minute walkthrough (spec 19 §11). */
export function Demo() {
  return (
    <section id="demo" aria-labelledby="demo-title" className="pb-24 max-[820px]:pb-16">
      <div className={wrap}>
        <div className="grid grid-cols-2 gap-10 rounded-[28px] border border-line bg-surface p-10 shadow-lg max-[820px]:grid-cols-1 max-[820px]:px-5 max-[820px]:py-[26px]">
          <div>
            <p className={cn('m-0', eyebrow)}>{t('public.demo.eyebrow')}</p>
            <h2 id="demo-title" className={cn(h2, 'mt-3')}>
              <Accented
                template={t('public.demo.title', { accent: SLOT_MARKER })}
                accent={t('public.demo.titleAccent')}
              />
            </h2>
            <p className={cn(lede, 'mt-3.5 text-[16.5px]')}>{t('public.demo.lede')}</p>
            <div className="mt-[22px] max-w-[440px]">
              <Painting viewBox="0 0 480 220" paint={teaScene} />
            </div>
          </div>
          <DemoForm to={CONTACT_EMAIL} labels={formLabels()} />
        </div>
      </div>
    </section>
  );
}
