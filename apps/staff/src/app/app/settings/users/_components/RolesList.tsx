'use client';

import { Chip } from '@quad/ui';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Role } from '@quad/contracts';

export interface RolesListProps {
  roles: readonly Role[];
  selectedId: string | null;
  onSelect: (role: Role) => void;
}

/** The school's roles as chips with how many people hold each; built-in ones carry a lock. */
export function RolesList({ roles, selectedId, onSelect }: RolesListProps) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('roles.list.label')}
      className="flex flex-wrap gap-2 border-b border-line px-[18px] py-3.5"
    >
      {roles.map((role) => (
        <Chip
          key={role.id}
          selected={role.id === selectedId}
          count={role.memberCount}
          aria-label={`${role.name}, ${t('roles.members', { count: role.memberCount })}`}
          onClick={() => {
            onSelect(role);
          }}
        >
          {role.system ? <Lock aria-hidden="true" strokeWidth={2} className="mr-1 size-3" /> : null}
          {role.name}
        </Chip>
      ))}
    </div>
  );
}
