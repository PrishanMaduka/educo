import { cn } from '@quad/ui';
import { Check } from 'lucide-react';

import { SectionHeading } from './SectionHeading';
import { SoftBadge, TONES } from './SoftBadge';
import { card, focusRing, lift, prose } from './styles';

import type { ArticleContent } from '../_lib/article';

import { t } from '@/i18n';

/**
 * The privacy policy and terms (D45): an "In short" card rising into the header, then one card
 * per section, each with its badge and its full text, beside an "On this page" card that stays in
 * view from 1100 px. Below that width the list becomes chips above the cards.
 */
export function LegalSections({ content }: { content: ArticleContent }) {
  return (
    <>
      {content.inShort && (
        <section aria-labelledby="in-short" className={cn(card, lift)}>
          <div className="grid grid-cols-[auto_1fr] items-start gap-x-7 gap-y-[18px] max-[760px]:grid-cols-1">
            <h2
              id="in-short"
              className="m-0 justify-self-start rounded-[22px] rounded-bl-md bg-site-lime px-[18px] py-3.5 text-xl leading-[1.1] font-extrabold tracking-[-.02em] text-site-on-vivid"
            >
              {t('public.page.inShort')}
            </h2>
            <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-2.5 p-0 max-[760px]:grid-cols-1">
              {content.inShort.map((point, index) => (
                <li
                  // The points are fixed copy in a fixed order.
                  key={index}
                  className="flex gap-2.5 text-[16.5px] leading-[1.45] text-site-page-ink [&_a]:rounded-sm [&_a]:underline [&_a]:underline-offset-2 [&_a:focus-visible]:outline-[3px] [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-site-focus [&_a:focus-visible]:outline-solid"
                >
                  <Check
                    aria-hidden="true"
                    focusable="false"
                    className="mt-px size-[22px] flex-none text-site-pine"
                  />
                  <span className="min-w-0">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <div
        className={cn(
          'mt-7 grid items-start gap-6 min-[1101px]:grid-cols-[minmax(0,1fr)_300px]',
          !content.inShort && lift,
        )}
      >
        <nav
          aria-labelledby="contents-title"
          className={cn(
            card,
            'px-[22px] py-5 min-[1101px]:sticky min-[1101px]:top-24 min-[1101px]:order-last',
          )}
        >
          <h2
            id="contents-title"
            className="m-0 mb-2.5 text-[13px] font-bold tracking-[.08em] text-site-page-ink-3 uppercase"
          >
            {t('public.page.contents')}
          </h2>
          <ol className="m-0 flex list-none flex-wrap gap-2 p-0 min-[1101px]:flex-col min-[1101px]:flex-nowrap min-[1101px]:gap-0.5">
            {content.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={cn(
                    'block rounded-full bg-site-sheet-2 px-[13px] py-1.5 text-sm font-semibold text-site-page-ink-2 no-underline hover:text-site-page-ink',
                    'min-[1101px]:-mx-2.5 min-[1101px]:rounded-[10px] min-[1101px]:bg-transparent min-[1101px]:px-2.5 min-[1101px]:py-[7px] min-[1101px]:text-[15px] min-[1101px]:hover:bg-site-sheet-2',
                    focusRing,
                  )}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="grid min-w-0 gap-3">
          {content.sections.map((section, index) => (
            <section
              key={section.id}
              aria-labelledby={section.id}
              className={cn(
                card,
                'grid grid-cols-[auto_minmax(0,1fr)] gap-x-[18px] gap-y-1.5 max-[560px]:grid-cols-1',
              )}
            >
              {section.icon && (
                <SoftBadge
                  icon={section.icon}
                  tone={section.tone ?? TONES[index % TONES.length]}
                  className="max-[560px]:size-9"
                />
              )}
              <SectionHeading
                id={section.id}
                title={section.title}
                className="self-center text-[clamp(22px,2.2vw,28px)] leading-[1.15] text-site-page-ink"
              />
              <div className={cn(prose(), 'col-start-2 min-w-0 max-[560px]:col-start-1')}>
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
