import { ConsoleSignIn } from './_components/ConsoleSignIn';

import { safeNext } from '@/lib/session';

/** `next` is read per request; nothing here may be prerendered with someone else's. */
export const dynamic = 'force-dynamic';

/**
 * `/sign-in?next=/audit…`: Quad staff sign in here (spec 05). `next` is where a signed-out visit
 * was going; only a console page is accepted.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <ConsoleSignIn next={safeNext(query.next)} />;
}
