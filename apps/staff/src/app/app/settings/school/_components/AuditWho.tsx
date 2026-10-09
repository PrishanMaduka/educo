'use client';

import { Avatar, Pill } from '@quad/ui';
import { useTranslation } from 'react-i18next';

import type { AuditActor } from '@quad/contracts';

/** Who did it: a member's avatar and name, the "Quad support" pill, or the system. */
export function AuditWho({ actor }: { actor: AuditActor }) {
  const { t } = useTranslation();
  switch (actor.type) {
    case 'member':
      return (
        <span className="inline-flex min-w-0 items-center gap-2">
          <Avatar name={actor.name} size="sm" decorative />
          <span className="truncate font-semibold text-ink">{actor.name}</span>
        </span>
      );
    case 'quad_support':
      return <Pill tone="info">{t('schoolSettings.audit.quadSupport')}</Pill>;
    case 'system':
      return <span className="text-ink-2">{t('schoolSettings.audit.system')}</span>;
  }
}
