import { publicSite } from '@quad/tokens';

import { Circle } from './_components/Circle';
import { Demo } from './_components/Demo';
import { Footer } from './_components/Footer';
import { Hero } from './_components/Hero';
import { More } from './_components/More';
import { Ticker } from './_components/Ticker';
import { TopBar } from './_components/TopBar';
import { Wellbeing } from './_components/Wellbeing';
import { SITE_ORIGIN } from './_lib/site';

import type { ComingSoonLabels } from './_components/SignInEntry';
import type { ThemeSwitchLabels } from './_components/ThemeSwitch';
import type { Metadata, Viewport } from 'next';

import { t } from '@/i18n';
import { publicEnv } from '@/lib/public-env';

const title = t('public.meta.title');
const description = t('public.meta.description');

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: `${SITE_ORIGIN}/` },
  openGraph: {
    type: 'website',
    url: `${SITE_ORIGIN}/`,
    siteName: t('public.wordmark'),
    title,
    description,
  },
  twitter: { card: 'summary', title, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: publicSite.light['hero-bg'] },
    { media: '(prefers-color-scheme: dark)', color: publicSite.dark['hero-bg'] },
  ],
};

/** The public landing page at `/` (spec 19), section by section as in design/landing.html. */
export default function LandingPage() {
  const prelaunch = publicEnv.NEXT_PUBLIC_QUAD_PRELAUNCH;
  const theme: ThemeSwitchLabels = {
    toDark: t('public.theme.toDark'),
    toLight: t('public.theme.toLight'),
    darkMode: t('public.theme.darkMode'),
    lightMode: t('public.theme.lightMode'),
  };
  const comingSoon: ComingSoonLabels = {
    badge: t('public.comingSoon.badge'),
    title: t('public.comingSoon.title'),
    body: t('public.comingSoon.body'),
    close: t('public.comingSoon.close'),
    bookDemo: t('public.cta.school'),
  };
  return (
    <>
      <a
        href="#main"
        className="absolute -top-20 left-4 z-[60] rounded-xl bg-site-lime px-4 py-2.5 font-bold text-site-on-vivid no-underline focus:top-3"
      >
        {t('public.skip')}
      </a>
      <span id="top" />
      <TopBar prelaunch={prelaunch} theme={theme} comingSoon={comingSoon} />
      <main id="main">
        <Hero prelaunch={prelaunch} comingSoon={comingSoon} />
        <Ticker />
        <Circle />
        <Wellbeing />
        <More />
        <Demo />
      </main>
      <Footer />
    </>
  );
}
