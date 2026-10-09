import { QuadLogo } from '@quad/tokens/logo';
import { cn } from '@quad/ui';

import { CONTACT_EMAIL } from '../_lib/site';

import { focusRing, wrap } from './styles';

import { t } from '@/i18n';

/** The public pages the footer links to (spec 19 footer, D41), in reading order. */
export const FOOTER_LINKS = [
  { href: '/about', label: 'public.footer.about' },
  { href: '/security', label: 'public.footer.security' },
  { href: '/legal/privacy', label: 'public.footer.privacy' },
  { href: '/legal/terms', label: 'public.footer.terms' },
  { href: '/legal/subprocessors', label: 'public.footer.subprocessors' },
] as const;

const link = cn('inline-block rounded-sm py-1 text-site-page-ink underline', focusRing);

/**
 * Footer (spec 19): the logo (to the top of the page on the landing page, home elsewhere), the
 * About, Security & trust and legal pages, the contact address, and the note that the sample
 * people are fictional. The DPA, cookie notice and status page are linked once they exist.
 */
export function Footer({ homeHref = '#top' }: { homeHref?: '#top' | '/' }) {
  return (
    <footer className="bg-site-page-bg text-site-page-ink">
      <div className={cn(wrap, 'flex flex-wrap items-center gap-x-8 gap-y-4 pb-8 text-sm')}>
        <a
          href={homeHref}
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
        <nav aria-label={t('public.footer.nav')}>
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
            {FOOTER_LINKS.map((item) => (
              <li key={item.href}>
                <a href={item.href} className={link}>
                  {t(item.label)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div
        className={cn(
          wrap,
          'flex flex-wrap items-center gap-x-8 gap-y-2 pb-8 text-sm text-site-page-ink-3',
        )}
      >
        <p className="m-0 mr-auto">
          {t('public.footer.contact')}{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <span>{t('public.footer.sample')}</span>
        <span>{t('public.footer.copyright')}</span>
      </div>
    </footer>
  );
}
