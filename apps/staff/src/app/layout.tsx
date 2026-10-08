import { themeBootstrapScript } from '@quad/ui/theme';
import { Figtree } from 'next/font/google';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { t } from '@/i18n';

import './globals.css';

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
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
