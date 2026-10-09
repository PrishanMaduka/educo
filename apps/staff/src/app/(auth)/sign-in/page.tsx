import { cookies } from 'next/headers';

import { SignInFlow } from './_components/SignInFlow';

import { lastSchoolFrom, safeNext } from '@/lib/session';

/** The remembered school is read per request, and nothing here may be cached or prerendered. */
export const dynamic = 'force-dynamic';

/** `/sign-in?next=/app/…`: the standalone sign-in page (spec 05), for deep links and sign-out. */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, jar] = await Promise.all([searchParams, cookies()]);
  return (
    <SignInFlow
      lastSchool={lastSchoolFrom(jar.get('quad_last_school')?.value)}
      next={safeNext(query.next)}
    />
  );
}
