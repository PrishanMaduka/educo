import { PageHead } from '@quad/ui/shell';


import { StyleGuide } from './_components/StyleGuide';
import { TokenSwatches } from './_components/TokenSwatches';

import type { Metadata } from 'next';

import { t } from '@/i18n';

export const metadata: Metadata = { title: t('design.title') };

/** The living style guide: every @quad/ui export and the colour tokens, in light and dark side by side. */
export default function DesignPage() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-[1480px] flex-col gap-8 p-6 max-[899px]:p-4"
    >
      <PageHead
        crumb={t('design.crumb')}
        title={t('design.title')}
        description={t('design.intro')}
      />
      <section aria-labelledby="design-tokens" className="flex flex-col gap-3">
        <h2 id="design-tokens" className="m-0 text-xl font-extrabold tracking-[-0.01em] text-ink">
          {t('design.tokens')}
        </h2>
        <TokenSwatches title={t('design.tokens')} />
      </section>
      <StyleGuide />
    </main>
  );
}
