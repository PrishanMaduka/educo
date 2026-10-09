import { PermissionAction, PermissionModule } from '@quad/contracts';

import type { MessageKey } from '@/i18n';
import type { SensitiveKey } from '@quad/contracts';
import type { PermissionMatrixColumn, PermissionMatrixRow } from '@quad/ui';

type Translate = (key: MessageKey) => string;

/** The matrix rows in matrix order, with the ones outside the school's plan marked. */
export function matrixRows(
  t: Translate,
  outsidePlan: readonly PermissionModule[],
): PermissionMatrixRow[] {
  return PermissionModule.options.map((module) => ({
    id: module,
    label: t(`roles.module.${module}`),
    notInPlan: outsidePlan.includes(module),
  }));
}

/** The five actions, View first (spec 05). */
export function matrixColumns(t: Translate): PermissionMatrixColumn[] {
  return PermissionAction.options.map((action) => ({
    id: action,
    label: t(`roles.action.${action}`),
  }));
}

const SENSITIVE_COPY: Record<SensitiveKey, { label: MessageKey; hint: MessageKey }> = {
  safeguarding: {
    label: 'roles.sensitive.safeguarding',
    hint: 'roles.sensitive.safeguardingHint',
  },
  medical: { label: 'roles.sensitive.medical', hint: 'roles.sensitive.medicalHint' },
  finance_reports: {
    label: 'roles.sensitive.financeReports',
    hint: 'roles.sensitive.financeReportsHint',
  },
  export_data: { label: 'roles.sensitive.exportData', hint: 'roles.sensitive.exportDataHint' },
};

/** A sensitive key's switch label and its one-line explanation. */
export function sensitiveCopy(key: SensitiveKey) {
  return SENSITIVE_COPY[key];
}

/** Whether a matrix id from the shared component is one of ours. */
export function isModule(id: string): id is PermissionModule {
  return PermissionModule.safeParse(id).success;
}

export function isAction(id: string): id is PermissionAction {
  return PermissionAction.safeParse(id).success;
}
