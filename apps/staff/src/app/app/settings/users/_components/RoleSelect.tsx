'use client';

import { Select } from '@quad/ui';
import { useTranslation } from 'react-i18next';

import type { Role, StaffMember } from '@quad/contracts';

export interface RoleSelectProps {
  member: StaffMember;
  roles: readonly Role[];
  busy: boolean;
  onChange: (role: Role) => void;
}

/** A member's role, changed in place (spec 08). Nobody changes their own role here. */
export function RoleSelect({ member, roles, busy, onChange }: RoleSelectProps) {
  const { t } = useTranslation();
  return (
    <Select
      aria-label={t('users.role.label', { name: member.name })}
      options={roles.map((role) => ({ value: role.id, label: role.name }))}
      value={member.role?.id ?? ''}
      placeholder={t('users.role.none')}
      disabled={member.you || busy}
      className="w-[180px] max-lg:w-full"
      onValueChange={(roleId) => {
        const role = roles.find((candidate) => candidate.id === roleId);
        if (role !== undefined && role.id !== member.role?.id) onChange(role);
      }}
    />
  );
}
