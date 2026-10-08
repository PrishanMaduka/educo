import { Painting } from '../_illustrations/Painting';
import { trustScenes } from '../_illustrations/sections';

import { SectionHead } from './SectionHead';
import { wrap } from './styles';

import { SLOT_MARKER, t } from '@/i18n';

const CARDS = ['wall', 'consent', 'lock', 'local'] as const;

/**
 * Privacy and safety (spec 19 §10). The links to the privacy policy and sub-processors arrive with
 * the legal pages (M1b); there is no legal text before then.
 */
export function Trust() {
  return (
    <section id="trust" aria-labelledby="trust-title" className="pb-24 max-[820px]:pb-16">
      <div className={wrap}>
        <SectionHead
          id="trust-title"
          eyebrow={t('public.trust.eyebrow')}
          title={t('public.trust.title', { accent: SLOT_MARKER })}
          accent={t('public.trust.titleAccent')}
          lede={t('public.trust.lede')}
        />
        <ul className="m-0 grid list-none grid-cols-4 gap-[18px] p-0 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
          {CARDS.map((key) => (
            <li
              key={key}
              className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface"
            >
              <Painting viewBox="0 0 260 150" paint={trustScenes[key]} />
              <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-5">
                <b className="text-[16.5px] font-extrabold">{t(`public.trust.${key}.title`)}</b>
                <span className="text-[14.5px] text-ink-2">{t(`public.trust.${key}.body`)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
