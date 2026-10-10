import type { ReactNode } from 'react';

import { Providers } from '@/components/Providers';
import { SchoolPaused } from '@/components/shell/SchoolPaused';
import { StaffShell } from '@/components/shell/StaffShell';
import { requireSignedIn } from '@/lib/server-session';

/**
 * The signed-in portal (spec 08). The server asks the API who is signed in (`GET /me`) and what
 * they may open (`GET /me/permissions`) before anything renders, so the first paint already has
 * the school's name, brand and the role's menu. An expired session goes back to sign-in.
 */
export default async function StaffAppLayout({ children }: { children: ReactNode }) {
  const session = await requireSignedIn();
  return (
    <Providers>
      {session.kind === 'suspended' ? (
        <SchoolPaused reason={session.reason} />
      ) : (
        <StaffShell me={session.me} permissions={session.permissions}>
          {children}
        </StaffShell>
      )}
    </Providers>
  );
}
