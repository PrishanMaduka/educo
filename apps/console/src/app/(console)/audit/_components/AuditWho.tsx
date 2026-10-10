'use client';

import { Avatar } from '@quad/ui';
import { useTranslation } from 'react-i18next';

import type { PlatformAuditActor } from '@quad/contracts';

/** Who did it, in the console's log: a Quad staff member's avatar and name, or the system. */
export function AuditWho({ actor }: { actor: PlatformAuditActor }) {
  const { t } = useTranslation();
  switch (actor.type) {
    case 'quad':
      return (
        <span className="inline-flex min-w-0 items-center gap-2">
          <Avatar name={actor.name} size="sm" decorative />
          <span className="truncate font-semibold text-ink">{actor.name}</span>
        </span>
      );
    case 'system':
      return <span className="text-ink-2">{t('console.audit.system')}</span>;
  }
}
