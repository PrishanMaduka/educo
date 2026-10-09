'use client';

import { Card, EmptyState, PermissionMatrix, useToast } from '@quad/ui';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isAction, isModule, matrixColumns, matrixRows } from './matrix-labels';
import { draftOf, isDirty, permissionsBody, toggleCell, toggleSensitive } from './role-draft';
import { RolesList } from './RolesList';
import { SaveBar } from './SaveBar';
import { SensitiveSwitches } from './SensitiveSwitches';

import type { RoleDraft } from './role-draft';
import type { UsersActions } from './use-users-data';
import type { Role, RoleList, SensitiveKey } from '@quad/contracts';

export interface RolesTabProps {
  roles: RoleList;
  selectedId: string | null;
  onSelect: (roleId: string) => void;
  /** The sensitive keys the signed-in admin holds (spec 08: no giving others). */
  held: readonly SensitiveKey[];
  actions: UsersActions;
}

/**
 * Roles & permissions (spec 05, 08; prototype `V.users` roles tab): the roles, then the chosen
 * role's module × action matrix and sensitive access. Built-in roles are locked; a custom role is
 * edited in place, with a sticky save bar while anything is unsaved.
 */
export function RolesTab({ roles, selectedId, onSelect, held, actions }: RolesTabProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const role = roles.items.find((item) => item.id === selectedId) ?? roles.items[0];
  // The draft belongs to the role as it was read: choosing another role, or a fresh read after a
  // save, starts again from what the API says.
  const [edit, setEdit] = useState<{ readonly base: Role; readonly draft: RoleDraft } | null>(null);

  if (role === undefined) {
    return (
      <Card>
        <EmptyState icon={ShieldAlert} title={t('users.loading')} />
      </Card>
    );
  }
  const draft = edit?.base === role ? edit.draft : draftOf(role);
  const setDraft = (next: RoleDraft) => {
    setEdit({ base: role, draft: next });
  };
  const dirty = !role.system && isDirty(draft, role);
  const choose = (next: Role) => {
    if (next.id === role.id) return;
    if (dirty) {
      toast.show(t('roles.toast.saveFirst'));
      return;
    }
    onSelect(next.id);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card flush>
        <RolesList roles={roles.items} selectedId={role.id} onSelect={choose} />
        <div className="border-b border-line px-[18px] py-3.5">
          <h2 className="m-0 text-[17px] font-bold text-ink">{role.name}</h2>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-2">
            {role.system ? t('roles.systemNote') : t('roles.customNote')}
          </p>
        </div>
        <PermissionMatrix
          caption={t('roles.matrix.caption', { role: role.name })}
          rows={matrixRows(t, roles.outsidePlan)}
          columns={matrixColumns(t)}
          value={draft.matrix}
          readOnly={role.system}
          moduleHeader={t('ui.matrix.module')}
          notInPlanLabel={t('ui.matrix.notInPlan')}
          cellLabel={(action, module) => t('ui.matrix.cell', { action, module })}
          onToggle={(module, action, checked) => {
            if (isModule(module) && isAction(action)) {
              setDraft(toggleCell(draft, module, action, checked));
            }
          }}
        />
        <p className="m-0 px-[18px] py-2.5 text-[12.5px] text-ink-2">{t('roles.matrix.hint')}</p>
      </Card>
      <Card title={t('roles.sensitive.title')} flush>
        <p className="m-0 border-b border-line px-[18px] py-2.5 text-[12.5px] text-ink-2">
          {t('roles.sensitive.subtitle')}
        </p>
        <SensitiveSwitches
          value={draft.sensitive}
          stored={role.sensitive}
          held={held}
          readOnly={role.system}
          onChange={(key, on) => {
            setDraft(toggleSensitive(draft, key, on));
          }}
        />
      </Card>
      {dirty ? (
        <SaveBar
          roleName={role.name}
          saving={actions.savePermissions.isPending}
          onDiscard={() => {
            setDraft(draftOf(role));
            toast.show(t('roles.toast.discarded'));
          }}
          onSave={() => {
            actions.savePermissions.mutate({
              role,
              body: permissionsBody(draft, roles.outsidePlan),
            });
          }}
        />
      ) : null}
    </div>
  );
}
