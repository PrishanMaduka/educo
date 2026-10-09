import { QuadLogo } from '@quad/tokens/logo';
import { cn } from '@quad/ui';

import { menuItem, PublicMenu } from './PublicMenu';
import { SignInEntry, type ComingSoonLabels } from './SignInEntry';
import { button, focusRing, onlyParent, onlySchool, wrap } from './styles';
import { ThemeSwitch, type ThemeSwitchLabels } from './ThemeSwitch';
import { ViewToggle } from './ViewToggle';

import { t } from '@/i18n';

const navLink = cn(
  'rounded-md text-site-on-navy-2 no-underline hover:text-site-on-navy',
  focusRing,
);

/** "Modules" for schools, "In the app" for parents. */
function MoreLabel() {
  return (
    <>
      <span className={onlySchool}>{t('public.nav.modules')}</span>
      <span className={onlyParent}>{t('public.nav.inTheApp')}</span>
    </>
  );
}

/** The landing page's bar: section links, Sign in and the view switch. */
interface LandingBar {
  page?: 'landing';
  prelaunch: boolean;
  theme: ThemeSwitchLabels;
  comingSoon: ComingSoonLabels;
}

/** The bar on the other public pages (D41): links to pages instead of sections, no view switch. */
interface PageBar {
  page: 'page';
  theme: ThemeSwitchLabels;
  /** The page's path, so its link is marked as the current page (D45). */
  current?: string;
}

/**
 * The top bar (spec 19): logo, section links and Sign in (Get the app for parents), the view
 * switch, the theme, Menu at 1100 px and below, and Book a demo (Ask your school for parents).
 * Sticky above 760 px. On the About, Security & trust and legal pages (`page="page"`) the logo
 * goes home, the links go to those pages (the current one underlined in lime), and Book a demo goes
 * to the landing page's form.
 */
export function TopBar(props: LandingBar | PageBar) {
  const { theme } = props;
  const isLanding = props.page !== 'page';
  const links = isLanding
    ? [
        { href: '#circle', label: t('public.nav.circle') },
        { href: '#wellbeing', label: t('public.nav.wellbeing') },
        { href: '#more', label: <MoreLabel /> },
      ]
    : [
        { href: '/about', label: t('public.nav.about') },
        { href: '/security', label: t('public.nav.security') },
        { href: '/legal/privacy', label: t('public.nav.privacy') },
        { href: '/legal/terms', label: t('public.nav.terms') },
      ];
  const current = props.page === 'page' ? props.current : undefined;
  return (
    <header className="sticky top-0 z-30 bg-site-nav-bg backdrop-blur-[10px] max-[760px]:static">
      <div
        className={cn(
          wrap,
          'relative flex items-center gap-x-6 gap-y-3.5 py-3.5 max-[760px]:flex-wrap',
        )}
      >
        <a
          href={isLanding ? '#top' : '/'}
          aria-label={t('public.nav.home')}
          className={cn('mr-auto flex items-center rounded-md text-site-on-navy', focusRing)}
        >
          <QuadLogo
            variant="theme"
            size={30}
            aria-hidden="true"
            className="block h-[30px] w-auto"
          />
        </a>
        <nav
          aria-label={t(isLanding ? 'public.nav.label' : 'public.nav.pages')}
          className="flex gap-[22px] text-[15px] font-medium max-[1100px]:hidden"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.href === current ? 'page' : undefined}
              className={cn(
                navLink,
                'aria-[current=page]:text-site-on-navy aria-[current=page]:underline aria-[current=page]:decoration-site-lime aria-[current=page]:decoration-[3px] aria-[current=page]:underline-offset-[9px]',
              )}
            >
              {link.label}
            </a>
          ))}
          {props.page !== 'page' && (
            <>
              {/* Staff sign in for schools; parents get the app instead. */}
              <span className={cn('contents', onlySchool)}>
                <SignInEntry
                  label={t('public.signIn')}
                  look="nav"
                  prelaunch={props.prelaunch}
                  comingSoon={props.comingSoon}
                />
              </span>
              <a href="#getapp" className={cn(navLink, onlyParent)}>
                {t('public.nav.getApp')}
              </a>
            </>
          )}
        </nav>
        {isLanding && (
          <ViewToggle
            label={t('public.view.label')}
            labels={{ school: t('public.view.school'), parent: t('public.view.parent') }}
            className="max-[760px]:order-5 max-[760px]:w-full"
          />
        )}
        <ThemeSwitch variant="icon" labels={theme} className="max-[760px]:hidden" />
        <PublicMenu
          label={t('public.nav.menu')}
          links={
            isLanding
              ? [
                  ...links,
                  { href: '#getapp', label: t('public.nav.getApp'), className: onlyParent },
                ]
              : links
          }
          theme={theme}
          signIn={
            props.page !== 'page' && (
              <span className={cn('contents', onlySchool)}>
                <SignInEntry
                  label={t('public.signIn')}
                  look="menu"
                  menuClassName={menuItem}
                  prelaunch={props.prelaunch}
                  comingSoon={props.comingSoon}
                />
              </span>
            )
          }
        />
        <a href={isLanding ? '#demo' : '/#demo'} className={button({ size: 'sm' })}>
          <span className={onlySchool}>{t('public.cta.school')}</span>
          <span className={onlyParent}>{t('public.cta.parent')}</span>
        </a>
      </div>
    </header>
  );
}
