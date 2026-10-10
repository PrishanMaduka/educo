import { cn } from '@quad/ui';

import { themeSwitchLabels } from '../_lib/public-labels';

import { ArticleHero } from './ArticleHero';
import { Footer } from './Footer';
import { LegalSections } from './LegalSections';
import { PromiseCards } from './PromiseCards';
import { SkipLink } from './SkipLink';
import { StorySections } from './StorySections';
import { wrap } from './styles';
import { TopBar } from './TopBar';

import type { ArticleContent } from '../_lib/article';

import { publicEnv } from '@/lib/public-env';

/**
 * An About, Security & trust or legal page in design option A, "Story cards" (D41, D45): the top
 * bar, the navy header with the one `<h1>` and the big Quad mark, then the sections as cards on
 * the cream page (laid out by `content.layout`), each heading a link to its own anchor, then the
 * footer. A server component: the only client code is the top bar's theme button and menu.
 */
export function ArticlePage({ content }: { content: ArticleContent }) {
  return (
    <>
      <SkipLink />
      <TopBar page="page" current={content.path} theme={themeSwitchLabels()} />
      <main id="main">
        <ArticleHero content={content} />
        <div className="bg-site-page-bg text-site-page-ink">
          <div className={cn(wrap, 'pb-[clamp(56px,7vw,96px)]')}>
            {content.layout === 'story' && <StorySections sections={content.sections} />}
            {content.layout === 'promises' && <PromiseCards sections={content.sections} />}
            {content.layout === 'legal' && <LegalSections content={content} />}
          </div>
        </div>
      </main>
      <Footer homeHref="/" prelaunch={publicEnv.NEXT_PUBLIC_QUAD_PRELAUNCH} />
    </>
  );
}
