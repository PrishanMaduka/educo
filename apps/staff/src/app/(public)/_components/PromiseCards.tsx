import { cn } from '@quad/ui';

import { SectionHeading } from './SectionHeading';
import { SoftBadge, TONES } from './SoftBadge';
import { focusRing, lift, prose, tintCard } from './styles';

import type { ArticleSection } from '../_lib/article';

import { t } from '@/i18n';

/**
 * Security & trust (D45): a grid of pale cards in the mark's four colours in turn, each with its
 * badge, title, one-line promise and the full text under "The detail" (a native `<details>`, so no
 * client code). A callout section (Report a security issue) spans the row on navy.
 */
export function PromiseCards({ sections }: { sections: readonly ArticleSection[] }) {
  return (
    <div
      className={cn(lift, 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-3.5')}
    >
      {sections.map((section, index) => {
        const icon = section.icon ?? 'shield';
        if (section.isCallout) {
          return (
            <section
              key={section.id}
              aria-labelledby={section.id}
              className="col-span-full flex flex-wrap items-center gap-3 rounded-[28px] border border-solid border-site-band-edge bg-site-navy p-6 text-site-on-navy"
            >
              <SoftBadge icon={icon} tone={section.tone ?? 'orange'} size="xxl" />
              <div className="min-w-0 flex-[1_1_320px]">
                <SectionHeading
                  id={section.id}
                  title={section.title}
                  className="text-[26px] leading-[1.1]"
                />
                <div className={cn(prose({ tone: 'navy', size: 'sm' }), 'mt-1.5')}>
                  {section.body}
                </div>
              </div>
            </section>
          );
        }
        const tint = section.tint ?? TONES[index % TONES.length] ?? 'sky';
        return (
          <section
            key={section.id}
            aria-labelledby={section.id}
            className={cn(tintCard({ tint }), 'flex flex-col gap-3 p-6 pb-[26px]')}
          >
            <div className="flex items-center gap-3">
              <SoftBadge icon={icon} tone="plain" size="lg" />
              <SectionHeading
                id={section.id}
                title={section.title}
                className="text-[22px] leading-[1.1]"
              />
            </div>
            {section.promise && (
              <p className="m-0 text-[19px] leading-[1.3] font-bold tracking-[-.02em] text-pretty">
                {section.promise}
              </p>
            )}
            <details className="group mt-auto border-t-[1.5px] border-solid border-site-on-vivid pt-2.5">
              <summary
                className={cn(
                  'flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-[14.5px] font-bold [&::-webkit-details-marker]:hidden',
                  focusRing,
                )}
              >
                {t('public.page.detail')}
                <span className="sr-only">: {section.title}</span>
                <span aria-hidden="true" className="ml-auto text-xl leading-none">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">–</span>
                </span>
              </summary>
              <div className={cn(prose({ tone: 'tint', size: 'sm' }), 'mt-2')}>{section.body}</div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
