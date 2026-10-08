import { QuadLogo } from '@quad/tokens/logo';
import { cn } from '@quad/ui';

import { menuItem, PublicMenu } from './PublicMenu';
import { SignInEntry, type ComingSoonLabels } from './SignInEntry';
import { button, focusRing, onlyParent, onlySchool, wrap } from './styles';
import { ThemeSwitch, type ThemeSwitchLabels } from './ThemeSwitch';
import { ViewToggle } from './ViewToggle';

import { t } from '@/i18n';

/** "Modules" for schools, "In the app" for parents. */
function MoreLabel() {
  return (
    <>
      <span className={onlySchool}>{t('public.nav.modules')}</span>
      <span className={onlyParent}>{t('public.nav.inTheApp')}</span>
    </>
  );
}

/**
 * The top bar (spec 19): logo, section links and Sign in, the view switch, the theme, Menu at
 * 1100 px and below, and Book a demo (Ask your school for parents). Sticky above 760 px.
 */
export function TopBar({
  prelaunch,
  theme,
  comingSoon,
}: {
  prelaunch: boolean;
  theme: ThemeSwitchLabels;
  comingSoon: ComingSoonLabels;
}) {
  const links = [
    { href: '#circle', label: t('public.nav.circle') },
    { href: '#wellbeing', label: t('public.nav.wellbeing') },
    { href: '#more', label: <MoreLabel /> },
  ];
  return (
    <header className="sticky top-0 z-30 bg-site-nav-bg backdrop-blur-[10px] max-[760px]:static">
      <div
        className={cn(
          wrap,
          'relative flex items-center gap-x-6 gap-y-3.5 py-3.5 max-[760px]:flex-wrap',
        )}
      >
        <a
          href="#top"
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
          aria-label={t('public.nav.label')}
          className="flex gap-[22px] text-[15px] font-medium max-[1100px]:hidden"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md text-site-on-navy-2 no-underline hover:text-site-on-navy',
                focusRing,
              )}
            >
              {link.label}
            </a>
          ))}
          <SignInEntry
            label={t('public.signIn')}
            look="nav"
            prelaunch={prelaunch}
            comingSoon={comingSoon}
          />
        </nav>
        <ViewToggle
          label={t('public.view.label')}
          labels={{ school: t('public.view.school'), parent: t('public.view.parent') }}
          className="max-[760px]:order-5 max-[760px]:w-full"
        />
        <ThemeSwitch variant="icon" labels={theme} className="max-[760px]:hidden" />
        <PublicMenu
          label={t('public.nav.menu')}
          links={links}
          theme={theme}
          signIn={
            <SignInEntry
              label={t('public.signIn')}
              look="menu"
              menuClassName={menuItem}
              prelaunch={prelaunch}
              comingSoon={comingSoon}
            />
          }
        />
        <a href="#demo" className={button({ size: 'sm' })}>
          <span className={onlySchool}>{t('public.cta.school')}</span>
          <span className={onlyParent}>{t('public.cta.parent')}</span>
        </a>
      </div>
    </header>
  );
}
