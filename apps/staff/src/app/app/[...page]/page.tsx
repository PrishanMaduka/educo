import { Card, EmptyState } from '@quad/ui';
import { PageHead } from '@quad/ui/shell';
import { Hammer } from 'lucide-react';
import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { NoAccess } from '@/components/shell/NoAccess';
import { accessOf, hiddenByOf, pageAtPath, roleNameOf } from '@/components/shell/staff-nav';
import { ViewOnlyTag } from '@/components/shell/ViewOnlyTag';
import { t } from '@/i18n';
import { requireSignedIn } from '@/lib/server-session';

interface PortalPageProps {
  params: Promise<{ page: string[] }>;
}

async function pageOf({ params }: PortalPageProps) {
  const { page } = await params;
  return pageAtPath(`/app/${page.join('/')}`);
}

export async function generateMetadata(props: PortalPageProps): Promise<Metadata> {
  const page = await pageOf(props);
  return page === undefined ? {} : { title: t(`nav.staff.page.${page.id}`) };
}

/**
 * Every staff page in the side bar that is not built yet (spec 08 Navigation): "{Page} arrives
 * soon", with the **View only** tag for a role that can only read it, or the no-access page
 * for a page outside the role or the school's plan (D52). Built pages get their own routes,
 * which take precedence.
 */
export default async function PortalPage(props: PortalPageProps) {
  const page = await pageOf(props);
  if (page === undefined) notFound();
  const session = await requireSignedIn();
  if (session.kind !== 'ready') return null;
  const { me, permissions } = session;
  const access = accessOf(permissions.pages, page.id);
  if (access === 'hidden') {
    return (
      <NoAccess
        page={page.id}
        roleName={roleNameOf(me) ?? t('shell.role.support')}
        home={permissions.home}
        hiddenBy={hiddenByOf(permissions.pages, page.id)}
      />
    );
  }
  const title = t(`nav.staff.page.${page.id}`);
  return (
    <>
      <PageHead title={title} actions={access === 'view_only' ? <ViewOnlyTag /> : undefined} />
      <Card>
        <EmptyState
          icon={Hammer}
          title={t('placeholder.soon.title', { page: title })}
          description={t('placeholder.soon.body')}
        />
      </Card>
    </>
  );
}
