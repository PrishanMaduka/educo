'use client';

import { Card, EmptyState, PermissionMatrix, useToast } from '@quad/ui';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { isAction, isModule, matrixColumns, matrixRows } from './matrix-labels';
import { draftFor, hasUnsaved, permissionsBody, toggleCell, toggleSensitive } from './role-draft';
import { RolesList } from './RolesList';
import { SensitiveSwitches } from './SensitiveSwitches';

import type { RoleDraft, RoleEdit } from './role-draft';
import type { UsersActions } from './use-users-data';
import type { Role, RoleList, SensitiveKey } from '@quad/contracts';

import { SaveBar } from '@/components/SaveBar';

export interface RolesTabProps {
  roles: RoleList;
  selectedId: string | null;
  onSelect: (roleId: string) => void;
  /** The sensitive keys the signed-in admin holds (spec 08: no giving others). */
  held: readonly SensitiveKey[];
  actions: UsersActions;
  /** The unsaved edit, kept by the page so a tab change or a fresh read does not lose it. */
  edit: RoleEdit | null;
  onEdit: (edit: RoleEdit | null) => void;
}

/**
 * Roles & permissions (spec 05, 08; prototype `V.users` roles tab): the roles, then the chosen
 * role's module × action matrix and sensitive access. Built-in roles are locked; a custom role is
 * edited in place, with a sticky save bar while anything is unsaved.
 */
export function RolesTab({
  roles,
  selectedId,
  onSelect,
  held,
  actions,
  edit,
  onEdit,
}: RolesTabProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const role = roles.items.find((item) => item.id === selectedId) ?? roles.items[0];

  if (role === undefined) {
    return (
      <Card>
        <EmptyState icon={ShieldAlert} title={t('users.loading')} />
      </Card>
    );
  }
  const draft = draftFor(edit, role);
  const setDraft = (next: RoleDraft) => {
    onEdit({ roleId: role.id, draft: next });
  };
  const dirty = hasUnsaved(edit, roles.items);
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
          <h2 className="m-0 font-display text-[17px] font-bold text-ink">{role.name}</h2>
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
          message={t('roles.saveBar.unsaved', { role: role.name })}
          discardLabel={t('roles.saveBar.discard')}
          saveLabel={t('roles.saveBar.save')}
          saving={actions.savePermissions.isPending}
          onDiscard={() => {
            onEdit(null);
            toast.show(t('roles.toast.discarded'));
          }}
          onSave={() => {
            actions.savePermissions.mutate(
              { role, body: permissionsBody(draft, roles.outsidePlan) },
              {
                // After the roles are read again, so the saved grant shows with no flicker.
                onSuccess: () => {
                  onEdit(null);
                },
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}
