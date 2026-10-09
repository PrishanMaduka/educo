import { buttonVariants } from '@quad/ui';
import { Shield } from 'lucide-react';
import Link from 'next/link';

import { hrefOf } from './staff-nav';

import type { StaffPageId } from '@quad/contracts';

import { t } from '@/i18n';

export interface NoAccessProps {
  page: StaffPageId;
  /** The role the person is in, or previewing. */
  roleName: string;
  /** The role's home page (`GET /me/permissions` `home`). */
  home: StaffPageId;
}

/**
 * A page outside the person's role (spec 08; prototype `rvDenied`): "{Page} isn't part of the
 * {role} role", with a link to the role's home. The API refuses the page's data anyway.
 */
export function NoAccess({ page, roleName, home }: NoAccessProps) {
  return (
    <section className="mx-auto my-14 flex max-w-[560px] flex-col items-center gap-3 text-center max-[899px]:my-8">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-ink-2">
        <Shield aria-hidden="true" strokeWidth={2} className="size-[26px]" />
      </span>
      <h1 className="m-0 text-[26px] leading-[1.2] font-extrabold tracking-[-0.02em] text-balance text-ink">
        {t('noAccess.title', { page: t(`nav.staff.page.${page}`), role: roleName })}
      </h1>
      <p className="m-0 text-[15px] text-ink-2">{t('noAccess.body')}</p>
      <Link href={hrefOf(home)} className={buttonVariants({ className: 'mt-1 rounded-full' })}>
        {t('noAccess.home', { page: t(`nav.staff.page.${home}`) })}
      </Link>
    </section>
  );
}
