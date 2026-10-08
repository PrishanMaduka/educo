import { QuadMark } from '@quad/tokens/logo';
import { cn } from '@quad/ui';

import { PublicMenu } from './PublicMenu';
import { SignInEntry, type ComingSoonLabels } from './SignInEntry';
import { button, focusRing, wrap } from './styles';
import { ThemeSwitch, type ThemeSwitchLabels } from './ThemeSwitch';

import { t } from '@/i18n';

/** Sticky top bar (spec 19 §1). At 900 px and below the section links and theme move into Menu. */
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
    { href: '#day', label: t('public.nav.day') },
    { href: '#ideas', label: t('public.nav.ideas') },
    { href: '#school', label: t('public.nav.school') },
    { href: '#trust', label: t('public.nav.trust') },
  ];
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-line/70 bg-canvas/86 backdrop-blur-md backdrop-saturate-[1.4]">
      <div className={cn(wrap, 'flex h-[68px] items-center gap-2.5 max-[480px]:gap-1.5')}>
        <a
          href="#top"
          aria-label={t('public.nav.home')}
          className={cn(
            'flex items-center gap-2.5 rounded-md text-[22px] font-black tracking-[-.02em] max-[480px]:gap-[7px] max-[480px]:text-[19px]',
            focusRing,
          )}
        >
          <QuadMark
            variant="theme"
            aria-hidden="true"
            className="size-[34px] max-[480px]:size-[30px]"
          />
          {t('public.wordmark')}
        </a>
        <nav
          aria-label={t('public.nav.label')}
          className="mr-3.5 ml-auto flex gap-[22px] max-[900px]:hidden"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-sm text-[14.5px] font-bold text-ink-2 hover:text-ink',
                focusRing,
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <PublicMenu label={t('public.nav.menu')} links={links} theme={theme} />
        <ThemeSwitch variant="icon" labels={theme} className="max-[900px]:hidden" />
        <SignInEntry
          label={t('public.signIn')}
          look="nav"
          prelaunch={prelaunch}
          comingSoon={comingSoon}
        />
        <a href="#demo" className={button({ size: 'nav' })}>
          {t('public.bookDemo')}
        </a>
      </div>
    </header>
  );
}
