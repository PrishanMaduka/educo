'use client';

import { AuthCard } from '@quad/ui/auth';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';


import { staffApi, unwrap } from '@/lib/api';

export interface OpeningProps {
  /** The school's name, or null when the API opened the person's only school. */
  school: string | null;
  /** Where the portal opens: `?next=` or `/app`. */
  next: string;
  onOpen: (path: string) => void;
}

/** "Opening {school}…" while the portal loads, then the page asked for. */
export function Opening({ school, next, onOpen }: OpeningProps) {
  const { t } = useTranslation();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => unwrap(staffApi().GET('/api/v1/me')),
    enabled: school === null,
    retry: false,
  });
  const name = school ?? me.data?.school.name ?? null;
  const ready = school !== null || !me.isPending;
  const opened = useRef(false);

  useEffect(() => {
    if (!ready || opened.current) return;
    opened.current = true;
    onOpen(next);
  }, [ready, next, onOpen]);

  return (
    <AuthCard
      title={
        name === null
          ? t('signIn.opening.titleNoName')
          : t('signIn.opening.title', { school: name })
      }
      lede={<span aria-live="polite">{t('signIn.opening.lede')}</span>}
    />
  );
}
