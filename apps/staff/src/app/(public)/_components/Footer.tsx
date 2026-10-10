import { QuadLogo } from '@quad/tokens/logo';
import { cn } from '@quad/ui';

import { COMPANY } from '../_lib/company';
import { comingSoonLabels } from '../_lib/public-labels';
import { CONTACT_EMAIL } from '../_lib/site';

import { SignInEntry } from './SignInEntry';
import { focusRing, footerLink, onlyParent, onlySchool, wrap } from './styles';

import { t } from '@/i18n';

/** The public pages the footer links to (spec 19 footer, D41, D44), in reading order. */
export const FOOTER_LINKS = [
  { href: '/about', label: 'public.footer.about' },
  { href: '/security', label: 'public.footer.security' },
  { href: '/legal/privacy', label: 'public.footer.privacy' },
  { href: '/legal/terms', label: 'public.footer.terms' },
  { href: '/legal/dpa', label: 'public.footer.dpa' },
  { href: '/legal/cookies', label: 'public.footer.cookies' },
] as const;

/**
 * One line in a group: a link, the Sign in entry, or plain text (the city). Labels are already
 * translated.
 */
interface Item {
  label: string;
  href?: string;
  /** The staff Sign in, which opens the coming-soon note before launch (D32 Pre-launch). */
  isSignIn?: boolean;
  /** Shown in one view only (school or parent). */
  className?: string;
}

const page = (entry: (typeof FOOTER_LINKS)[number]): Item => ({
  href: entry.href,
  label: t(entry.label),
});
const [about, security, privacy, terms, dpa, cookies] = FOOTER_LINKS.map(page) as [
  Item,
  Item,
  Item,
  Item,
  Item,
  Item,
];

/**
 * The four link groups (D43), one per quarter of the Quad mark, with the corner that points to the
 * mark's centre kept tight. `#` links are landing-page sections; from the other pages they go to
 * the landing page first.
 */
function groups(onLanding: boolean): { title: string; card: string; items: Item[] }[] {
  const at = (id: string) => (onLanding ? `#${id}` : `/#${id}`);
  return [
    {
      title: t('public.footer.explore'),
      card: 'bg-site-sky rounded-[28px] rounded-br-lg',
      items: [
        { href: at('circle'), label: t('public.nav.circle') },
        { href: at('wellbeing'), label: t('public.nav.wellbeing') },
        { href: at('more'), label: t('public.nav.modules'), className: onlySchool },
        { href: at('more'), label: t('public.nav.inTheApp'), className: onlyParent },
      ],
    },
    {
      title: t('public.footer.forSchools'),
      card: 'bg-site-pink rounded-[28px] rounded-bl-lg',
      items: [
        { href: at('demo'), label: t('public.cta.school') },
        { label: t('public.signIn'), isSignIn: true },
        security,
      ],
    },
    {
      title: t('public.footer.company'),
      card: 'bg-site-lime rounded-[28px] rounded-tr-lg',
      items: [
        about,
        { href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL },
        { label: COMPANY.registeredAddress },
      ],
    },
    {
      title: t('public.footer.legal'),
      card: 'bg-site-orange rounded-[28px] rounded-tl-lg',
      // Cookie settings joins these when Google Analytics is set up (M1b Task 13).
      items: [privacy, terms, dpa, cookies],
    },
  ];
}

/**
 * Footer (spec 19, D43 "circle quarters"): the logo and a line on the circle, then the four link
 * groups on sky, pink, lime and orange cards (one quarter of the Quad mark each), and the company
 * line with the note that the sample people are fictional. The logo goes to the top of the landing
 * page, or home from the other pages. Sign in is the same entry as the top bar's, so before launch
 * it opens the coming-soon note rather than a portal the pre-launch site does not have.
 */
export function Footer({
  homeHref = '#top',
  prelaunch,
}: {
  homeHref?: '#top' | '/';
  prelaunch: boolean;
}) {
  const onLanding = homeHref === '#top';
  return (
    <footer className="bg-site-page-bg text-site-page-ink">
      <div className={cn(wrap, 'pt-14 pb-7')}>
        <div className="mb-7 flex flex-wrap items-center gap-5">
          <a
            href={homeHref}
            aria-label={t('public.nav.home')}
            className={cn('rounded-md text-site-page-ink', focusRing)}
          >
            <QuadLogo variant="theme" size={28} aria-hidden="true" className="block h-7 w-auto" />
          </a>
          <p className="m-0 text-site-page-ink-3">{t('public.footer.tagline')}</p>
        </div>
        <nav aria-label={t('public.footer.nav')}>
          <ul className="m-0 grid list-none grid-cols-4 gap-3 p-0 max-[760px]:grid-cols-2 max-[420px]:grid-cols-1">
            {groups(onLanding).map((group) => (
              <li
                key={group.title}
                className={cn('p-[22px] text-site-on-vivid max-[760px]:rounded-[20px]', group.card)}
              >
                <h2 className="m-0 mb-3 text-[13px] font-bold tracking-[.08em] uppercase">
                  {group.title}
                </h2>
                <ul className="m-0 list-none p-0">
                  {group.items.map((item) => (
                    <li key={`${item.label}${item.href ?? ''}`} className={item.className}>
                      {item.isSignIn ? (
                        <SignInEntry
                          label={item.label}
                          look="footer"
                          prelaunch={prelaunch}
                          comingSoon={comingSoonLabels()}
                          demoHref={onLanding ? '#demo' : '/#demo'}
                        />
                      ) : item.href ? (
                        <a href={item.href} className={footerLink}>
                          {item.label}
                        </a>
                      ) : (
                        <span className="inline-block py-1">{item.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-10 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-solid border-site-card-line pt-5 text-[13px] text-site-page-ink-3">
          <span>
            {t('public.footer.copyright', {
              year: new Date().getFullYear(),
              company: COMPANY.legalName,
            })}
          </span>
          <span>{t('public.footer.sample')}</span>
        </div>
      </div>
    </footer>
  );
}
