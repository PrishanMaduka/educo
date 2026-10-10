import { buttonVariants } from '@quad/ui';
import { Shield } from 'lucide-react';
import Link from 'next/link';

import { hrefOf } from './staff-nav';

import type { PageHiddenBy, StaffPageId } from '@quad/contracts';

import { t } from '@/i18n';

export interface NoAccessProps {
  page: StaffPageId;
  /** The role the person is in, or previewing. */
  roleName: string;
  /** The role's home page (`GET /me/permissions` `home`). */
  home: StaffPageId;
  /** Why the page is hidden (`GET /me/permissions` `pages[].hiddenBy`, D52); `role` when unsaid. */
  hiddenBy?: PageHiddenBy;
}

/**
 * A page the person can't open (spec 08; prototype `rvDenied`), with a link to the role's home.
 * Outside the role: "{Page} isn't part of the {role} role". Outside the school's plan (D52):
 * "{Page} isn't included in your school's plan", which names no role, since no role could open
 * it. The API refuses the page's data anyway.
 */
export function NoAccess({ page, roleName, home, hiddenBy = 'role' }: NoAccessProps) {
  const pageName = t(`nav.staff.page.${page}`);
  const title =
    hiddenBy === 'plan'
      ? t('noAccess.plan.title', { page: pageName })
      : t('noAccess.title', { page: pageName, role: roleName });
  const body = hiddenBy === 'plan' ? t('noAccess.plan.body') : t('noAccess.body');
  return (
    <section className="mx-auto my-14 flex max-w-[560px] flex-col items-center gap-3 text-center max-[899px]:my-8">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-ink-2">
        <Shield aria-hidden="true" strokeWidth={2} className="size-[26px]" />
      </span>
      <h1 className="m-0 text-[26px] leading-[1.2] font-extrabold tracking-[-0.02em] text-balance text-ink">
        {title}
      </h1>
      <p className="m-0 text-[15px] text-ink-2">{body}</p>
      <Link href={hrefOf(home)} className={buttonVariants({ className: 'mt-1 rounded-full' })}>
        {t('noAccess.home', { page: t(`nav.staff.page.${home}`) })}
      </Link>
    </section>
  );
}
