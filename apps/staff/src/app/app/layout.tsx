import type { ReactNode } from 'react';

import { StaffShell } from '@/components/shell/StaffShell';
import { I18nProvider } from '@/i18n/client';

export default function StaffAppLayout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <StaffShell>{children}</StaffShell>
    </I18nProvider>
  );
}
