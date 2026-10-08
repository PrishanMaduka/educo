import type { ReactNode } from 'react';

import { I18nProvider } from '@/i18n/client';

/** The style guide's samples read their strings in the browser. */
export default function DesignLayout({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
