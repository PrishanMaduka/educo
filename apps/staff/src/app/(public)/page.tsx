import { Circle } from './_components/Circle';
import { Demo } from './_components/Demo';
import { Footer } from './_components/Footer';
import { Hero } from './_components/Hero';
import { More } from './_components/More';
import { SkipLink } from './_components/SkipLink';
import { Ticker } from './_components/Ticker';
import { TopBar } from './_components/TopBar';
import { Wellbeing } from './_components/Wellbeing';
import { publicPageMetadata, publicViewport } from './_lib/page-meta';
import { comingSoonLabels, themeSwitchLabels } from './_lib/public-labels';

import type { Metadata, Viewport } from 'next';

import { t } from '@/i18n';
import { publicEnv } from '@/lib/public-env';

export const metadata: Metadata = publicPageMetadata({
  path: '/',
  title: t('public.meta.title'),
  description: t('public.meta.description'),
});

export const viewport: Viewport = publicViewport;

/** The public landing page at `/` (spec 19), section by section as in design/landing.html. */
export default function LandingPage() {
  const prelaunch = publicEnv.NEXT_PUBLIC_QUAD_PRELAUNCH;
  const theme = themeSwitchLabels();
  const comingSoon = comingSoonLabels();
  return (
    <>
      <SkipLink />
      <span id="top" />
      <TopBar prelaunch={prelaunch} theme={theme} comingSoon={comingSoon} />
      <main id="main">
        <Hero prelaunch={prelaunch} comingSoon={comingSoon} />
        <Ticker />
        <Circle />
        <Wellbeing />
        <More />
        <Demo prelaunch={prelaunch} />
      </main>
      <Footer prelaunch={prelaunch} />
    </>
  );
}
