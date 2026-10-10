import { themeBootstrapScript } from '@quad/ui/shell';
import localFont from 'next/font/local';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';
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
  title: { default: t('app.name.console'), template: `%s · ${t('app.name.console')}` },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-app="console" switches the tokens to the console's darker rail and lilac active item.
    // The inline script sets data-theme before paint, so React must not complain that <html> differs.
    <html lang="en" data-app="console" className={figtree.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
