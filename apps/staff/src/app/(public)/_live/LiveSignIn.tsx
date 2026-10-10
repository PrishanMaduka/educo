import type { ReactNode } from 'react';

/**
 * Sign in on the live site (spec 19 "Sign-in"). For now a link to the portal, which sends a
 * signed-out visitor to `/sign-in`.
 * TODO(M1b): open the sign-in dialog on the landing page (plan Task 7).
 */
export function LiveSignIn({ label, className }: { label: string; className?: string }): ReactNode {
  return (
    <a href="/app" className={className}>
      {label}
    </a>
  );
}
