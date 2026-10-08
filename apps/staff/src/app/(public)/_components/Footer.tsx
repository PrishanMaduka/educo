import { QuadLogo } from '@quad/tokens/logo';
import { cn } from '@quad/ui';

import { CONTACT_EMAIL } from '../_lib/site';

import { focusRing, wrap } from './styles';

import { t } from '@/i18n';

/**
 * Footer (spec 19). Only links to pages that exist: the legal pages and the status page arrive
 * later, so for now the footer has the contact address.
 */
export function Footer() {
  return (
    <footer className="bg-site-page-bg text-site-page-ink">
      <div className={cn(wrap, 'flex flex-wrap items-center gap-x-8 gap-y-4 pb-8 text-sm')}>
        <a
          href="#top"
          aria-label={t('public.nav.home')}
          className={cn('mr-auto rounded-md text-site-page-ink', focusRing)}
        >
          <QuadLogo
            variant="theme"
            size={26}
            aria-hidden="true"
            className="block h-[26px] w-auto"
          />
        </a>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className={cn('rounded-sm text-site-page-ink underline', focusRing)}
        >
          {CONTACT_EMAIL}
        </a>
        <span className="text-site-page-ink-3">{t('public.footer.sample')}</span>
        <span className="text-site-page-ink-3">{t('public.footer.copyright')}</span>
      </div>
    </footer>
  );
}
