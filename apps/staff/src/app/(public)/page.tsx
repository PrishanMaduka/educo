import { publicSite } from '@quad/tokens';

import { CircleSection } from './_components/CircleSection';
import { DayBand } from './_components/DayBand';
import { Demo } from './_components/Demo';
import { Footer } from './_components/Footer';
import { Hero } from './_components/Hero';
import { Ideas } from './_components/Ideas';
import { Leaders } from './_components/Leaders';
import { Strip } from './_components/Strip';
import { TopBar } from './_components/TopBar';
import { Trust } from './_components/Trust';
import { WholeSchool } from './_components/WholeSchool';
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
    { media: '(prefers-color-scheme: light)', color: publicSite.palette.light.canvas },
    { media: '(prefers-color-scheme: dark)', color: publicSite.palette.dark.canvas },
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
    bookDemo: t('public.bookDemo'),
  };
  return (
    <>
      <a
        href="#main"
        className="absolute -top-[60px] left-4 z-50 rounded-input bg-ink px-4 py-2.5 font-extrabold text-canvas focus:top-3"
      >
        {t('public.skip')}
      </a>
      <span id="top" />
      <TopBar prelaunch={prelaunch} theme={theme} comingSoon={comingSoon} />
      <main id="main">
        <Hero prelaunch={prelaunch} comingSoon={comingSoon} />
        <Strip />
        <CircleSection />
        <DayBand />
        <Ideas />
        <Leaders />
        <WholeSchool />
        <Trust />
        <Demo />
      </main>
      <Footer />
    </>
  );
}
