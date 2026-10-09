'use client';

import { Button } from '@quad/ui';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { MePreview } from '@quad/contracts';

export interface PreviewBannerProps {
  preview: MePreview;
  onBack: () => void;
  leaving: boolean;
}

/**
 * Preview a role (spec 08; prototype `#rvBar`): "Previewing as {role} · {sample person}" with
 * **Back to my view**, the one write a preview allows.
 */
export function PreviewBanner({ preview, onBack, leaving }: PreviewBannerProps) {
  const { t } = useTranslation();
  const title =
    preview.sampleUser === null
      ? t('preview.banner.title', { role: preview.roleName })
      : t('preview.banner.withSample', {
          role: preview.roleName,
          name: preview.sampleUser.name,
        });
  return (
    <div className="bg-canvas px-6 pt-3 max-[899px]:px-3 max-[899px]:pt-2.5">
      <div
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-[14px] border border-gold/35 bg-surface px-3.5 py-2.5 text-[13.5px] text-ink"
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-gold-soft text-ink">
          <Shield aria-hidden="true" strokeWidth={2} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-extrabold">{title}</p>
          <p className="m-0 text-[12.5px] text-ink-2">{t('preview.banner.detail')}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          disabled={leaving}
          className="ml-auto"
        >
          {t('preview.back')}
        </Button>
      </div>
    </div>
  );
}
