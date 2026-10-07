import { QuadMark } from '@quad/tokens/logo';
import { buttonVariants } from '@quad/ui';
import Link from 'next/link';

import { t } from '@/i18n';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="flex w-full max-w-[480px] flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-10 text-center shadow-card">
        <QuadMark size={48} aria-hidden="true" />
        <h1 className="m-0 mt-2 text-[26px] leading-[1.2] font-extrabold tracking-[-0.02em] text-balance">
          {t('notFound.title')}
        </h1>
        <p className="m-0 text-[15px] text-ink-2">{t('notFound.body')}</p>
        <Link
          href="/app"
          className={buttonVariants({ className: 'mt-2 h-[38px] rounded-full px-4' })}
        >
          {t('notFound.action')}
        </Link>
      </div>
    </main>
  );
}
