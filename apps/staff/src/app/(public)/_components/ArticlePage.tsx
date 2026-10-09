import { cn, formatDate } from '@quad/ui';

import { themeSwitchLabels } from '../_lib/public-labels';

import { Footer } from './Footer';
import { SkipLink } from './SkipLink';
import { display, focusRing, wrap } from './styles';
import { TopBar } from './TopBar';

import type { ArticleContent } from '../_lib/article';

import { t } from '@/i18n';

/** Legal dates are shown as written, in the company's home time zone. */
const LEGAL_TIME_ZONE = 'Asia/Colombo';

/** About 65 characters a line (D41). */
const measure = 'max-w-[65ch]';

/**
 * Body text on the cream page: paragraphs, lists, small headings, links and tables, all on the
 * `site-*` tokens.
 */
export const prose = cn(
  'text-[17px] leading-[1.65] text-site-page-ink-2',
  '[&_p]:my-4 [&_ul]:my-4 [&_ul]:pl-5 [&_ol]:my-4 [&_ol]:pl-5 [&_li]:my-1.5 [&_li]:pl-1',
  '[&_strong]:font-bold [&_strong]:text-site-page-ink',
  '[&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-site-page-ink',
  '[&_a]:rounded-sm [&_a]:text-site-page-ink [&_a]:underline [&_a]:underline-offset-2',
  '[&_a:focus-visible]:outline-[3px] [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-site-focus [&_a:focus-visible]:outline-solid',
);

/**
 * An About, Security & trust or legal page (D41): the top bar, a navy header with the one `<h1>`
 * and the story sentence (and, on legal pages, "Last updated" and the version), then the sections
 * on the cream page at a readable measure, each heading a link to itself, then the footer.
 * A server component: the only client code is the top bar's theme button and menu.
 */
export function ArticlePage({ content }: { content: ArticleContent }) {
  const { updated } = content;
  return (
    <>
      <SkipLink />
      <TopBar page="page" theme={themeSwitchLabels()} />
      <main id="main">
        <header className="bg-site-hero-bg">
          <div className={cn(wrap, 'pt-14 pb-16 max-[760px]:pt-8 max-[760px]:pb-10')}>
            <p className="m-0 mb-4 text-sm font-bold tracking-[.08em] text-site-on-navy-2 uppercase">
              {content.eyebrow}
            </p>
            <h1
              className={cn(
                display,
                'text-[clamp(38px,6vw,64px)] leading-[1.02] text-site-on-navy',
              )}
            >
              {content.title}
            </h1>
            <p className={cn(measure, 'm-0 mt-5 text-xl leading-[1.5] text-site-on-navy-2')}>
              {content.summary}
            </p>
            {updated && (
              <p className="m-0 mt-6 text-sm text-site-on-navy-3">
                {t('public.page.updated', {
                  date: formatDate(`${updated.date}T00:00:00Z`, LEGAL_TIME_ZONE, 'long'),
                  version: updated.version,
                })}
              </p>
            )}
          </div>
        </header>
        <div className="bg-site-page-bg text-site-page-ink">
          <div
            className={cn(
              wrap,
              'grid gap-x-16 pt-12 pb-20 max-[760px]:pt-8 max-[760px]:pb-14',
              content.hasContents && 'min-[1101px]:grid-cols-[240px_minmax(0,1fr)]',
            )}
          >
            {content.hasContents && (
              <nav
                aria-labelledby="contents-title"
                className="mb-10 min-[1101px]:sticky min-[1101px]:top-24 min-[1101px]:self-start"
              >
                <h2
                  id="contents-title"
                  className="m-0 mb-3 text-sm font-bold tracking-[.08em] text-site-page-ink-3 uppercase"
                >
                  {t('public.page.contents')}
                </h2>
                <ol className="m-0 list-none p-0 text-[15px]">
                  {content.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className={cn(
                          'inline-block rounded-sm py-1 text-site-page-ink-2 no-underline hover:text-site-page-ink hover:underline',
                          focusRing,
                        )}
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <article
              className={cn(
                'min-w-0',
                content.isWide ? 'max-w-[1000px] [&_p]:max-w-[65ch]' : measure,
              )}
            >
              {content.sections.map((section) => (
                <section key={section.id} aria-labelledby={section.id} className="mb-12 last:mb-0">
                  <h2
                    id={section.id}
                    className="m-0 mb-1 scroll-mt-24 text-[clamp(24px,3vw,30px)] leading-[1.15] font-extrabold tracking-[-.03em] text-site-page-ink"
                  >
                    <a
                      href={`#${section.id}`}
                      className={cn(
                        'group rounded-sm text-site-page-ink no-underline hover:underline',
                        focusRing,
                      )}
                    >
                      {section.title}
                      <span
                        aria-hidden="true"
                        className="ml-2 text-site-page-ink-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                      >
                        #
                      </span>
                    </a>
                  </h2>
                  <div className={prose}>{section.body}</div>
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>
      <Footer homeHref="/" />
    </>
  );
}
