import { themeBootstrapScript } from '@quad/ui/theme';
import localFont from 'next/font/local';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { t } from '@/i18n';

import './globals.css';

// Figtree (OFL, _fonts/OFL.txt), self-hosted so builds never fetch from Google Fonts (the Pages
// export must build offline). One variable file with the latin and latin-ext characters Google
// Fonts serves, unhinted like Google's own files, so text renders as it did when loaded from Google Fonts.
const figtree = localFont({
  src: './_fonts/figtree-latin.woff2',
  weight: '400 800',
  style: 'normal',
  variable: '--font-figtree',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: t('app.name.staff'), template: `%s · ${t('app.name.staff')}` },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * The root layout. Translations reach client components through `I18nProvider` in the portal's
 * own layouts, so the public pages load no i18n code in the browser.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The inline script sets data-theme before paint, so React must not complain that <html> differs.
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
