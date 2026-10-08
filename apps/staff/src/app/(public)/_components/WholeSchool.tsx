import { Painting } from '../_illustrations/Painting';
import { campusScene } from '../_illustrations/sections';

import { SectionHead } from './SectionHead';
import { wrap } from './styles';

import { SLOT_MARKER, t } from '@/i18n';

const MODULES = [
  'admissions',
  'students',
  'attendance',
  'timetable',
  'exams',
  'pastoral',
  'fees',
  'communication',
] as const;

/** Your whole school: the campus and the eight modules (spec 19 §9). The list carries the meaning. */
export function WholeSchool() {
  return (
    <section
      id="school"
      aria-labelledby="school-title"
      className="bg-[linear-gradient(180deg,var(--quad-canvas),var(--quad-wash-2)_40%,var(--quad-canvas))] py-24 max-[820px]:py-16"
    >
      <div className={wrap}>
        <SectionHead
          id="school-title"
          eyebrow={t('public.school.eyebrow')}
          title={t('public.school.title', { accent: SLOT_MARKER })}
          accent={t('public.school.titleAccent')}
          lede={t('public.school.lede')}
        />
        <div className="-mx-5 overflow-hidden max-[480px]:-mx-4">
          <Painting viewBox="0 0 1080 400" paint={campusScene} />
        </div>
        <ol className="m-0 mt-5 grid list-none grid-cols-4 gap-3 p-0 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
          {MODULES.map((key, i) => (
            <li
              key={key}
              className="grid grid-cols-[30px_minmax(0,1fr)] content-start items-start gap-x-3 gap-y-1 rounded-[18px] border border-line bg-surface px-[18px] py-4"
            >
              <span
                aria-hidden="true"
                className="row-span-2 grid size-[30px] place-items-center rounded-full bg-coral-fill text-sm font-black text-coral-fill-ink"
              >
                {i + 1}
              </span>
              <b className="pt-1 text-base leading-[1.3] font-extrabold">
                {t(`public.school.modules.${key}.title`)}
              </b>
              <span className="text-sm leading-[1.45] text-ink-2">
                {t(`public.school.modules.${key}.body`)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
