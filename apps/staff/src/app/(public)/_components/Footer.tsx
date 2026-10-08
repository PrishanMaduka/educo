import { QuadMark } from '@quad/tokens/logo';
import { cn } from '@quad/ui';

import { CONTACT_EMAIL } from '../_lib/site';

import { focusRing, wrap } from './styles';

import { t } from '@/i18n';

const link = cn('rounded-sm font-bold text-ink-2 hover:text-ink', focusRing);

/**
 * Footer (spec 19 §12). Only links to pages that exist: the legal pages and the status page arrive
 * later, so for now the footer has the contact address.
 */
export function Footer() {
  return (
    <footer className="border-t border-line pt-10 pb-14 text-[13.5px] text-ink-2">
      <div className={cn(wrap, 'flex flex-wrap items-center gap-x-7 gap-y-3')}>
        <a
          href="#top"
          aria-label={t('public.nav.home')}
          className={cn(
            'flex items-center gap-2 text-[17px] font-black tracking-[-.02em] text-ink',
            focusRing,
          )}
        >
          <QuadMark variant="theme" aria-hidden="true" className="size-6" />
          {t('public.wordmark')}
        </a>
        <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
          {t('public.footer.contact')} {CONTACT_EMAIL}
        </a>
        <span className="ml-auto max-[620px]:ml-0">{t('public.footer.sample')}</span>
        <span>{t('public.footer.copyright')}</span>
      </div>
    </footer>
  );
}
