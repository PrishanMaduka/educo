'use client';

import { Select } from '@quad/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { PreviewChoice } from './use-shell-actions';
import type { MePreview } from '@quad/contracts';

import { staffApi, unwrap } from '@/lib/api';

/** The option for the person's own view. */
const SELF = 'self';

export interface ViewAsPickerProps {
  preview: MePreview | null;
  onChoose: (choice: PreviewChoice) => void;
  onBack: () => void;
  busy: boolean;
}

/**
 * **View as** in the top bar, desktop only (spec 08 Preview a role; prototype `#rvPick`): the
 * school's roles, and the person's own view. Roles scoped to their own classes preview a sample
 * member holding the role. While previewing, the role list may be outside the previewed role's
 * permissions, so the current role is always offered.
 */
export function ViewAsPicker({ preview, onChoose, onBack, busy }: ViewAsPickerProps) {
  const { t } = useTranslation();
  const roles = useQuery({
    queryKey: ['roles', 'view-as'],
    queryFn: () => unwrap(staffApi().GET('/api/v1/roles')),
    retry: false,
    staleTime: 60_000,
  });
  const listed = roles.data?.items ?? [];
  const current =
    preview !== null && !listed.some((role) => role.id === preview.roleId)
      ? [{ value: preview.roleId, label: t('preview.picker.role', { role: preview.roleName }) }]
      : [];
  const options = [
    { value: SELF, label: t('preview.picker.self') },
    ...current,
    ...listed.map((role) => ({
      value: role.id,
      label: t('preview.picker.role', { role: role.name }),
    })),
  ];
  return (
    <Select
      aria-label={t('preview.picker.label')}
      options={options}
      value={preview?.roleId ?? SELF}
      disabled={busy}
      className="w-[200px]"
      onValueChange={(value) => {
        if (value === SELF) {
          if (preview !== null) onBack();
          return;
        }
        const role = listed.find((candidate) => candidate.id === value);
        if (role === undefined || value === preview?.roleId) return;
        onChoose({
          roleId: role.id,
          needsSample: role.scope === 'own_classes',
          previewing: preview !== null,
        });
      }}
    />
  );
}
