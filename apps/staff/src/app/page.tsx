import { QuadLogo } from '@quad/tokens/logo';
import { buttonVariants } from '@quad/ui';
import Link from 'next/link';

import { t } from '@/i18n';

/** Placeholder for the public landing page (spec 19, built in M1b). */
export default function LandingPlaceholder() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="flex max-w-[520px] flex-col items-center gap-4 text-center">
        <QuadLogo size={40} />
        <h1 className="m-0 text-[30px] leading-[1.15] font-extrabold tracking-[-0.02em] text-balance">
          {t('landing.placeholder.title')}
        </h1>
        <p className="m-0 text-[15px] text-ink-2">{t('landing.placeholder.body')}</p>
        <Link href="/app" className={buttonVariants({ className: 'h-[38px] rounded-full px-4' })}>
          {t('landing.placeholder.action')}
        </Link>
      </div>
    </main>
  );
}
