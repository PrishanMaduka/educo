import type { ReactNode } from 'react';

import { ConsoleSession } from '@/components/session/ConsoleSession';
import { ConsoleShell } from '@/components/shell/ConsoleShell';

/**
 * Every signed-in console page. The session is checked in the browser (`ConsoleSession`, D50),
 * never here: the console cookies are `SameSite=Strict` and miss a link's first request.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleSession>
      <ConsoleShell>{children}</ConsoleShell>
    </ConsoleSession>
  );
}
