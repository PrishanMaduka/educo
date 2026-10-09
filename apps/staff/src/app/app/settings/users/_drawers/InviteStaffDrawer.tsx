'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { StaffInviteInput } from '@quad/contracts';
import { Button, Drawer, DrawerClose, Select, Textarea } from '@quad/ui';
import { Send, UserPlus } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { splitEmails } from '../_components/people';

import type { UsersActions } from '../_components/use-users-data';
import type { Role } from '@quad/contracts';

import { ApiError } from '@/lib/api';
import { actionMessageFor } from '@/lib/error-copy';

/** The drawer's fields: the addresses as typed, parsed with the contract's own rules. */
const InviteForm = z.object({
  emails: z.string().transform(splitEmails).pipe(StaffInviteInput.shape.emails),
  roleId: StaffInviteInput.shape.roleId,
});
type InviteFormInput = z.input<typeof InviteForm>;
type InviteFormOutput = z.output<typeof InviteForm>;

/** The role a new invite starts on: Teacher, as in the prototype, or else the first role. */
function defaultRoleId(roles: readonly Role[]): string {
  return (roles.find((role) => role.key === 'teacher') ?? roles[0])?.id ?? '';
}

export interface InviteStaffDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: readonly Role[];
  invite: UsersActions['invite'];
}

/**
 * Invite staff (spec 05 invites, spec 08; prototype `inviteStaff`): one or many addresses and the
 * role they will hold. Each refused address is named under the field.
 */
export function InviteStaffDrawer({ open, onOpenChange, roles, invite }: InviteStaffDrawerProps) {
  const { t } = useTranslation();
  const form = useForm<InviteFormInput, unknown, InviteFormOutput>({
    resolver: zodResolver(InviteForm),
    defaultValues: { emails: '', roleId: defaultRoleId(roles) },
  });
  const { control, register, handleSubmit, reset, setError, formState } = form;

  const startRole = defaultRoleId(roles);
  useEffect(() => {
    if (open) reset({ emails: '', roleId: startRole });
  }, [open, reset, startRole]);

  const submit = handleSubmit(async (values) => {
    try {
      await invite.mutateAsync({ emails: values.emails, roleId: values.roleId });
      onOpenChange(false);
    } catch (error) {
      const fields = error instanceof ApiError ? error.fields : {};
      const named = Object.entries(fields).flatMap(([path, message]) => {
        const index = /^emails\.(\d+)$/.exec(path)?.[1];
        const email = index === undefined ? undefined : values.emails[Number(index)];
        return email === undefined ? [] : [t('users.invite.addressError', { email, message })];
      });
      setError('emails', {
        message: named.length > 0 ? named.join(' ') : actionMessageFor(error, (key) => t(key)),
      });
    }
  });

  const emailsError = (() => {
    const error = formState.errors.emails;
    if (error === undefined) return undefined;
    if (error.message !== undefined && error.message !== '') return error.message;
    // Each address the contract refuses is reported at its index; name them all.
    const typed = splitEmails(form.getValues('emails'));
    // The array's own errors sit at numeric keys beside `message` and `type`.
    const entries: [string, unknown][] = Object.entries(error);
    const named = entries
      .filter(([key]) => /^\d+$/.test(key))
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([index, issue]) => {
        const message =
          typeof issue === 'object' && issue !== null && 'message' in issue
            ? String(issue.message)
            : '';
        return t('users.invite.addressError', { email: typed[Number(index)] ?? '', message });
      });
    return named.length > 0 ? named.join(' ') : undefined;
  })();

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('users.invite.title')}
      subtitle={t('users.invite.subtitle')}
      icon={UserPlus}
      // A refused invite keeps what was typed, so closing still asks; a sent one closes the
      // drawer itself, which never asks.
      dirty={formState.isDirty}
      footer={
        <>
          <DrawerClose asChild>
            <Button variant="secondary">{t('common.cancel')}</Button>
          </DrawerClose>
          <Button type="submit" form="invite-staff" icon={Send} disabled={formState.isSubmitting}>
            {t('users.invite.send')}
          </Button>
        </>
      }
    >
      <form
        id="invite-staff"
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
        className="flex flex-col gap-3.5"
      >
        <Textarea
          label={t('users.invite.emails')}
          hint={t('users.invite.emailsHint')}
          error={emailsError}
          rows={3}
          autoComplete="off"
          {...register('emails')}
        />
        <Controller
          control={control}
          name="roleId"
          render={({ field, fieldState }) => (
            <Select
              label={t('users.invite.role')}
              options={roles.map((role) => ({ value: role.id, label: role.name }))}
              value={field.value}
              error={fieldState.error?.message}
              onValueChange={field.onChange}
            />
          )}
        />
      </form>
    </Drawer>
  );
}
