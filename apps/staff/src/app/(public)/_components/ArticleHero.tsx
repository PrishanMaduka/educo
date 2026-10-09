import { QuadMark } from '@quad/tokens/logo';
import { cn, formatDate } from '@quad/ui';

import { display, wrap } from './styles';

import type { ArticleContent } from '../_lib/article';

import { t } from '@/i18n';

/** Legal dates are shown as written, in the company's home time zone. */
const LEGAL_TIME_ZONE = 'Asia/Colombo';

/**
 * The navy header of an About, Security & trust or legal page (D45): a pill with the small mark
 * and the eyebrow, the page's one `<h1>`, the story sentence and, on legal pages, "Last updated"
 * and the version. The big Quad mark on the right is decorative; on phones it shrinks and sits
 * above the heading, and it only turns when the visitor allows motion.
 */
export function ArticleHero({ content }: { content: ArticleContent }) {
  const { updated } = content;
  return (
    <header className="relative overflow-hidden bg-site-hero-bg text-site-on-navy">
      <div
        className={cn(
          wrap,
          'flex flex-wrap items-center justify-between gap-x-14 gap-y-8',
          'pt-[clamp(40px,6vw,88px)] pb-[clamp(72px,9vw,128px)] max-[760px]:pt-7 max-[760px]:pb-[72px]',
        )}
      >
        <div className="flex min-w-0 flex-[1_1_520px] flex-col items-start gap-[22px]">
          <p className="m-0 inline-flex items-center gap-2 rounded-full bg-site-navy-2 py-1.5 pr-3.5 pl-1.5 text-sm font-semibold text-site-lime">
            <QuadMark size={22} aria-hidden="true" className="block" />
            {content.eyebrow}
          </p>
          <h1
            className={cn(
              display,
              'text-[clamp(44px,6.4vw,96px)] leading-[.92] tracking-[-.04em] text-site-on-navy',
            )}
          >
            {content.title}
          </h1>
          <p className="m-0 max-w-[34em] text-[clamp(17px,1.5vw,21px)] leading-[1.5] text-pretty text-site-on-navy-2">
            {content.summary}
          </p>
          {updated && (
            <p className="m-0 rounded-full bg-site-navy-2 px-3 py-1 text-sm text-site-on-navy-2">
              {t('public.page.updated', {
                date: formatDate(`${updated.date}T00:00:00Z`, LEGAL_TIME_ZONE, 'long'),
                version: updated.version,
              })}
            </p>
          )}
        </div>
        <div
          aria-hidden="true"
          className="aspect-square w-[clamp(200px,26vw,360px)] flex-none -rotate-[10deg] drop-shadow-[0_30px_50px_var(--quad-site-phone-shadow)] max-[760px]:order-first max-[760px]:w-[120px]"
        >
          <QuadMark
            size={360}
            title=""
            className="block size-full motion-safe:animate-spin-slow motion-safe:[animation-duration:40s] max-[760px]:animate-none"
          />
        </div>
      </div>
    </header>
  );
}
