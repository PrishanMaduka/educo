'use client';

import { cn } from '@quad/ui';
import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { MeSupport } from '@quad/contracts';

export interface SupportBannerProps {
  support: MeSupport;
  onExit: () => void;
  exiting: boolean;
}

/**
 * The support view banner (spec 05 Support access; prototype `#supportBar`): Quad navy, always in
 * view under the top bar, announced politely, with **Exit to platform**.
 */
export function SupportBanner({ support, onExit, exiting }: SupportBannerProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 bg-rail px-6 py-2.5 text-[13px] font-semibold text-rail-ink max-[899px]:px-4"
    >
      <Eye aria-hidden="true" strokeWidth={2} className="size-4 shrink-0" />
      <span className="min-w-[200px] flex-1">
        {t('support.banner', { school: support.schoolName, name: support.platformUserName })}
      </span>
      <button
        type="button"
        onClick={onExit}
        disabled={exiting}
        className={cn(
          'min-h-9 cursor-pointer rounded-full border border-rail-ink/40 bg-rail-ink/15 px-3.5 font-bold text-rail-ink hover:bg-rail-ink/25 disabled:cursor-not-allowed disabled:opacity-60 max-[899px]:min-h-11',
          'outline-none focus-visible:ring-2 focus-visible:ring-focus',
        )}
      >
        {t('support.exit')}
      </button>
    </div>
  );
}
