import { themeBootstrapScript } from '@quad/ui/shell';
import localFont from 'next/font/local';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';
import { t } from '@/i18n';

import './globals.css';

// The two typefaces (spec 03 "Type", D34), self-hosted so builds never fetch from Google Fonts (the
// Pages export must build offline). Figtree (OFL, _fonts/OFL-Figtree.txt) works: one variable file
// with the latin and latin-ext characters Google Fonts serves, unhinted like Google's own files.
const figtree = localFont({
  src: './_fonts/figtree-latin.woff2',
  weight: '400 800',
  style: 'normal',
  variable: '--font-figtree',
  display: 'swap',
});

// Bricolage Grotesque (OFL, _fonts/OFL-BricolageGrotesque.txt) speaks: titles, greetings and big
// numbers (`font-display`), and the public site (`font-site`). Variable in weight and optical size;
// Google Fonts' latin build for Linux and Windows, as the macOS build has no hinting program and
// renders about 3 % wider there than the prototype.
const bricolage = localFont({
  src: './_fonts/bricolage-grotesque-latin.woff2',
  weight: '400 800',
  style: 'normal',
  variable: '--font-bricolage',
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
    // data-app="console" marks the console; it has no token overrides since D34 (navy bar, lime active item).
    // The inline script sets data-theme before paint, so React must not complain that <html> differs.
    <html
      lang="en"
      data-app="console"
      className={`${figtree.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
