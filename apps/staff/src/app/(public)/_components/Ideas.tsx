import { cn } from '@quad/ui';

import { Painting } from '../_illustrations/Painting';
import { ideaScenes } from '../_illustrations/sections';

import { SectionHead } from './SectionHead';
import { h3, wrap } from './styles';

import { SLOT_MARKER, t } from '@/i18n';

/** The four ideas, each with its kicker colour and the quote's border colour (prototype `.idea`). */
const IDEAS = [
  { key: 'story', kicker: 'text-c2', quote: 'border-c3' },
  { key: 'warning', kicker: 'text-coral-ink', quote: 'border-c1' },
  {
    key: 'ask',
    kicker: 'text-[color-mix(in_srgb,var(--quad-c5)_55%,var(--quad-ink))]',
    quote: 'border-c5',
  },
  {
    key: 'brand',
    kicker: 'text-[color-mix(in_srgb,var(--quad-c4)_55%,var(--quad-ink))]',
    quote: 'border-c4',
  },
] as const;

/** Why Quad: four ideas that put people first (spec 19 §7). */
export function Ideas() {
  return (
    <section id="ideas" aria-labelledby="ideas-title" className="py-24 max-[820px]:py-16">
      <div className={wrap}>
        <SectionHead
          id="ideas-title"
          eyebrow={t('public.ideas.eyebrow')}
          title={t('public.ideas.title', { accent: SLOT_MARKER })}
          accent={t('public.ideas.titleAccent')}
          lede={t('public.ideas.lede')}
        />
        <div className="grid grid-cols-2 gap-5 max-[820px]:grid-cols-1">
          {IDEAS.map(({ key, kicker, quote }) => (
            <article
              key={key}
              aria-labelledby={`idea-${key}`}
              className="flex flex-col overflow-hidden rounded-[26px] border border-line bg-surface"
            >
              <Painting viewBox="0 0 520 260" paint={ideaScenes[key]} />
              <div className="flex flex-1 flex-col gap-2.5 px-[26px] pt-6 pb-[26px]">
                <span className={cn('text-xs font-extrabold tracking-[.12em] uppercase', kicker)}>
                  {t(`public.ideas.${key}.kicker`)}
                </span>
                <h3 id={`idea-${key}`} className={h3}>
                  {t(`public.ideas.${key}.title`)}
                </h3>
                <p className="m-0 text-[15.5px] text-ink-2">{t(`public.ideas.${key}.body`)}</p>
                <blockquote
                  className={cn(
                    'mx-0 mt-auto mb-0 rounded-[4px_14px_14px_4px] border-l-[3px] bg-surface-2 px-4 py-3 text-[14.5px] text-ink',
                    quote,
                  )}
                >
                  <small className="mb-[3px] block text-[11.5px] font-extrabold tracking-[.08em] text-ink-2 uppercase">
                    {t(`public.ideas.${key}.quoteLabel`)}
                  </small>
                  {t(`public.ideas.${key}.quote`)}
                  {key === 'ask' ? (
                    <span className="text-ink-2"> {t('public.ideas.ask.quoteAnswer')}</span>
                  ) : null}
                </blockquote>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
