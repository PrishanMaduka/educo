import { cn } from '@quad/ui';
import { Check } from 'lucide-react';

import { Painting } from '../_illustrations/Painting';
import { villageScene } from '../_illustrations/sections';
import { heatStep, SAMPLE_CLASSES, SAMPLE_HEAT_ROWS } from '../_lib/sample-school';

import { Accented } from './Accented';
import { eyebrow, h2, lede, wrap } from './styles';

import { SLOT_MARKER, t } from '@/i18n';

const POINTS = ['pulse', 'followUp', 'quiet'] as const;

/** Heat cells: coral, then three teal steps; the two strongest carry `heat-ink` text (spec 19). */
const HEAT = [
  'bg-heat-0 text-ink',
  'bg-heat-1 text-ink',
  'bg-heat-2 text-heat-ink',
  'bg-heat-3 text-heat-ink',
];
const KEY = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3'];

/** For school leaders: is every family connected? (spec 19 §8, static sample data). */
export function Leaders() {
  return (
    <section aria-labelledby="leaders-title" className="pb-24 max-[820px]:pb-16">
      <div
        className={cn(
          wrap,
          'grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-10 max-[900px]:grid-cols-1',
        )}
      >
        <div>
          <p className={cn('m-0', eyebrow)}>{t('public.leaders.eyebrow')}</p>
          <h2 id="leaders-title" className={cn(h2, 'mt-3')}>
            <Accented
              template={t('public.leaders.title', { accent: SLOT_MARKER })}
              accent={t('public.leaders.titleAccent')}
            />
          </h2>
          <p className={cn(lede, 'mt-4')}>{t('public.leaders.lede')}</p>
          <ul className="m-0 mt-[22px] grid list-none gap-3.5 p-0">
            {POINTS.map((key) => (
              <li key={key} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 text-ink-2">
                <Check
                  aria-hidden="true"
                  strokeWidth={2.4}
                  className="mt-0.5 size-[22px] text-c5"
                />
                <div>
                  <b className="block text-ink">{t(`public.leaders.${key}.title`)}</b>
                  {t(`public.leaders.${key}.body`)}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-lg">
          <Painting viewBox="0 0 560 190" paint={villageScene} />
          <div className="px-[22px] pt-[18px] pb-[22px]">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2.5">
              <b className="text-[17px] font-extrabold">{t('public.leaders.heat.title')}</b>
              <small className="text-[13px] font-bold text-ink-2">
                {t('public.leaders.heat.note')}
              </small>
            </div>
            <div className="overflow-x-auto">
              <table
                aria-label={t('public.leaders.heat.label')}
                className="w-full border-separate border-spacing-[5px] text-[12.5px]"
              >
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="pr-1.5 text-left font-bold whitespace-nowrap text-ink-2"
                    >
                      <span className="sr-only">{t('public.leaders.heat.yearGroup')}</span>
                    </th>
                    {SAMPLE_CLASSES.map((name) => (
                      <th
                        key={name}
                        scope="col"
                        className="pr-1.5 text-left font-bold whitespace-nowrap text-ink-2"
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_HEAT_ROWS.map(({ yearGroup, values }) => (
                    <tr key={yearGroup}>
                      <th
                        scope="row"
                        className="pr-1.5 text-left font-bold whitespace-nowrap text-ink-2"
                      >
                        {yearGroup}
                      </th>
                      {values.map((value, i) => (
                        <td
                          key={SAMPLE_CLASSES[i]}
                          className={cn(
                            'h-[34px] rounded-lg text-center font-extrabold tabular-nums',
                            HEAT[heatStep(value)],
                          )}
                        >
                          {t('public.leaders.heat.cell', { value })}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              aria-hidden="true"
              className="mt-2.5 flex items-center justify-end gap-1.5 text-xs text-ink-2"
            >
              <span>{t('public.leaders.heat.fewer')}</span>
              {KEY.map((cell) => (
                <i key={cell} className={cn('inline-block h-2.5 w-[22px] rounded-[3px]', cell)} />
              ))}
              <span>{t('public.leaders.heat.all')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
