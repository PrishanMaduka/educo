import { ArrowLeftRight, LogOut, Undo2 } from 'lucide-react';

import type { MessageKey } from '@/i18n';
import type { Me } from '@quad/contracts';
import type { ShellProfileMenu } from '@quad/ui/shell';

export interface ProfileMenuActions {
  readonly backToMyView: () => void;
  readonly switchSchool: (tenantId: string) => void;
  readonly signOut: () => void;
}

/**
 * The profile menu (spec 05 Switch school; spec 08): the current school, then either **Back to
 * my view** while a role preview is on (Switch school is a write the preview refuses, Task 12,
 * so it comes back once the preview ends) or the person's other schools (a paused one listed but
 * not openable), and **Sign out**.
 */
export function switchSchoolMenu(
  me: Me,
  actions: ProfileMenuActions,
  t: (key: MessageKey, values?: Record<string, string>) => string,
): ShellProfileMenu {
  const sections: ShellProfileMenu['sections'] = [];
  if (me.preview !== null) {
    sections.push({
      id: 'preview',
      items: [
        { id: 'back', label: t('preview.back'), icon: Undo2, onSelect: actions.backToMyView },
      ],
    });
  }
  // While previewing, Switch school waits until the person is back in their own view.
  const others = me.preview === null ? me.memberships : [];
  const schools = others.map((school) => ({
    id: school.tenantId,
    label: school.name,
    icon: ArrowLeftRight,
    disabled: school.suspended,
    ...(school.suspended ? { hint: t('shell.profile.paused') } : {}),
    onSelect: () => {
      actions.switchSchool(school.tenantId);
    },
  }));
  if (schools.length > 0) {
    sections.push({ id: 'schools', label: t('shell.profile.switchSchool'), items: schools });
  }
  sections.push({
    id: 'account',
    items: [{ id: 'sign-out', label: t('auth.signOut'), icon: LogOut, onSelect: actions.signOut }],
  });
  return { heading: me.school.name, sections };
}
