'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { RoleCreateInput, RoleScope } from '@quad/contracts';
import { NO_ACCESS } from '@quad/domain';
import { colors } from '@quad/tokens';
import {
  Button,
  buttonVariants,
  Card,
  cn,
  EmptyState,
  Input,
  PermissionMatrix,
  Select,
  Textarea,
  useToast,
} from '@quad/ui';
import { ArrowLeft, Check, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { isAction, isModule, matrixColumns, matrixRows } from '../../../_components/matrix-labels';
import {
  draftOf,
  isDirty,
  permissionsBody,
  toggleCell,
  toggleSensitive,
  type RoleDraft,
} from '../../../_components/role-draft';
import { SensitiveSwitches } from '../../../_components/SensitiveSwitches';
import { useRoles, useUsersActions } from '../../../_components/use-users-data';
import { usersHref } from '../../../_components/UsersRoles';

import type { MessageKey } from '@/i18n';
import type { Role, SensitiveKey } from '@quad/contracts';

import { staffApi, unwrap } from '@/lib/api';
import { actionMessageFor, fieldError } from '@/lib/error-copy';

/** The colours a role can take: token colours, stored as their light value (prototype swatches). */
const SWATCHES = [
  { token: 'c1', className: 'bg-c1' },
  { token: 'c2', className: 'bg-c2' },
  { token: 'c3', className: 'bg-c3' },
  { token: 'c4', className: 'bg-c4' },
  { token: 'c5', className: 'bg-c5' },
  { token: 'good', className: 'bg-good' },
  { token: 'info', className: 'bg-info' },
] as const;

const SCOPE_COPY: Record<RoleScope, { label: MessageKey; hint: MessageKey }> = {
  school: { label: 'roles.scope.school', hint: 'roles.scope.schoolHint' },
  campus: { label: 'roles.scope.campus', hint: 'roles.scope.campusHint' },
  own_classes: { label: 'roles.scope.ownClasses', hint: 'roles.scope.ownClassesHint' },
};

/** "Blank (no permissions)" in Start from. */
const BLANK = 'blank';

/** The form's fields: the contract's, with Start from as the select gives it. */
const NewRoleFields = RoleCreateInput.omit({ baseRoleKey: true }).extend({
  baseRoleKey: z.string().min(1),
});
type NewRoleFieldsInput = z.input<typeof NewRoleFields>;
type NewRoleFieldsOutput = z.output<typeof NewRoleFields>;

/** Blank: no access anywhere, no sensitive keys. */
const EMPTY: RoleDraft = {
  matrix: {
    admissions: NO_ACCESS,
    crm: NO_ACCESS,
    sis: NO_ACCESS,
    attendance: NO_ACCESS,
    lms: NO_ACCESS,
    fees: NO_ACCESS,
    finance: NO_ACCESS,
    transport: NO_ACCESS,
    settings: NO_ACCESS,
  },
  sensitive: [],
};

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Card flush>
      <header className="flex items-center gap-2.5 border-b border-line px-[18px] py-3.5">
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-brand-soft text-xs font-bold text-ink"
        >
          {n}
        </span>
        <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
      </header>
      {children}
    </Card>
  );
}

export interface NewRoleFormProps {
  /** The sensitive keys the signed-in admin holds: no others can be given (spec 08). */
  held: readonly SensitiveKey[];
}

/**
 * New role (spec 08 role builder; prototype `ukRolePage(ctx, null)`). Creating copies the chosen
 * role's matrix and keys on the server (`POST /roles`); any change made here is then saved with
 * `PUT /roles/:id/permissions`, and the Roles tab opens on the new role.
 */
export function NewRoleForm({ held }: NewRoleFormProps) {
  const roles = useRoles();
  const { t } = useTranslation();
  if (roles.data === undefined) {
    return (
      <Card>
        <EmptyState
          icon={ShieldAlert}
          title={roles.isError ? t('users.loadFailed') : t('users.loading')}
        />
      </Card>
    );
  }
  return <Builder roles={roles.data.items} outsidePlan={roles.data.outsidePlan} held={held} />;
}

function Builder({
  roles,
  outsidePlan,
  held,
}: {
  roles: readonly Role[];
  outsidePlan: Parameters<typeof matrixRows>[1];
  held: readonly SensitiveKey[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { refresh } = useUsersActions();
  const startRole = roles.find((role) => role.key === 'teacher') ?? roles[0];
  const [draft, setDraft] = useState<RoleDraft>(startRole ? draftOf(startRole) : EMPTY);
  const form = useForm<NewRoleFieldsInput, unknown, NewRoleFieldsOutput>({
    resolver: zodResolver(NewRoleFields),
    defaultValues: {
      name: '',
      description: '',
      color: colors.light.c2,
      scope: 'school',
      baseRoleKey: startRole?.key ?? BLANK,
    },
  });
  const { control, register, handleSubmit, setError, formState } = form;

  const submit = handleSubmit(async (values) => {
    let created: Role;
    try {
      created = await unwrap(
        staffApi().POST('/api/v1/roles', {
          body: {
            name: values.name,
            ...(values.description === undefined || values.description === ''
              ? {}
              : { description: values.description }),
            color: values.color,
            scope: values.scope,
            baseRoleKey: values.baseRoleKey === BLANK ? null : values.baseRoleKey,
          },
        }),
      );
    } catch (error) {
      const name = fieldError(error, 'name');
      if (name !== undefined) setError('name', { message: name });
      else toast.show(actionMessageFor(error, (key) => t(key)));
      return;
    }
    // The server copied the base role; save what was changed here on top of it.
    if (isDirty(draft, created)) {
      try {
        await unwrap(
          staffApi().PUT('/api/v1/roles/{id}/permissions', {
            params: { path: { id: created.id } },
            body: permissionsBody(draft, outsidePlan),
          }),
        );
      } catch (error) {
        toast.show(actionMessageFor(error, (key) => t(key)));
      }
    }
    await refresh();
    toast.show(t('roles.toast.created', { role: created.name }));
    router.push(usersHref('roles', created.id));
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-3">
        <Link
          href={usersHref('roles')}
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'self-start' })}
        >
          <ArrowLeft aria-hidden="true" strokeWidth={2} className="size-3.5" />
          {t('roles.newPage.back')}
        </Link>
        <div>
          <h1 className="m-0 text-[30px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ink">
            {t('roles.new')}
          </h1>
          <p className="m-0 mt-1.5 max-w-[70ch] text-[15px] text-ink-2">
            {t('roles.newPage.intro')}
          </p>
        </div>
      </div>

      <Step n={1} title={t('roles.form.lookTitle')}>
        <div className="grid gap-3.5 px-[18px] py-4 sm:grid-cols-2">
          <Input
            label={t('roles.form.name')}
            placeholder={t('roles.form.namePlaceholder')}
            error={formState.errors.name?.message}
            fieldClassName="sm:col-span-2"
            autoComplete="off"
            {...register('name')}
          />
          <Textarea
            label={t('roles.form.description')}
            placeholder={t('roles.form.descriptionPlaceholder')}
            error={formState.errors.description?.message}
            fieldClassName="sm:col-span-2"
            rows={2}
            {...register('description')}
          />
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <fieldset className="m-0 flex min-w-0 flex-col gap-[5px] border-0 p-0">
                <legend className="mb-[5px] p-0 text-xs font-bold text-ink-2">
                  {t('roles.form.color')}
                </legend>
                <div
                  role="radiogroup"
                  aria-label={t('roles.form.color')}
                  className="flex flex-wrap gap-2"
                >
                  {SWATCHES.map((swatch) => {
                    const value = colors.light[swatch.token];
                    const chosen = field.value === value;
                    return (
                      <button
                        key={swatch.token}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        aria-label={t(`roles.color.${swatch.token}`)}
                        onClick={() => {
                          field.onChange(value);
                        }}
                        className={cn(
                          'grid size-8 cursor-pointer place-items-center rounded-lg border-2 text-surface max-sm:size-11',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                          swatch.className,
                          chosen ? 'border-ink' : 'border-transparent',
                        )}
                      >
                        {chosen ? (
                          <Check aria-hidden="true" strokeWidth={3} className="size-4" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          />
          <Controller
            control={control}
            name="baseRoleKey"
            render={({ field }) => (
              <Select
                label={t('roles.form.startFrom')}
                options={[
                  ...roles.map((role) => ({ value: role.key, label: role.name })),
                  { value: BLANK, label: t('roles.form.blank') },
                ]}
                value={field.value}
                onValueChange={(key) => {
                  field.onChange(key);
                  const next = roles.find((role) => role.key === key);
                  setDraft(next === undefined ? EMPTY : draftOf(next));
                }}
              />
            )}
          />
        </div>
      </Step>

      <Step n={2} title={t('roles.form.scopeTitle')}>
        <Controller
          control={control}
          name="scope"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-label={t('roles.form.scopeTitle')}
              className="grid gap-2.5 px-[18px] py-4 md:grid-cols-3"
            >
              {RoleScope.options.map((scope) => (
                <label
                  key={scope}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5',
                    field.value === scope ? 'border-brand bg-brand-soft' : 'border-line',
                  )}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={scope}
                    checked={field.value === scope}
                    onChange={() => {
                      field.onChange(scope);
                    }}
                    className="mt-0.5 size-4 accent-brand-fill"
                  />
                  <span className="block min-w-0 text-[13.5px] font-bold text-ink">
                    {t(SCOPE_COPY[scope].label)}
                    <span className="block text-xs font-normal text-ink-2">
                      {t(SCOPE_COPY[scope].hint)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        />
      </Step>

      <Step n={3} title={t('roles.form.permissionsTitle')}>
        <PermissionMatrix
          caption={t('roles.matrix.caption', { role: t('roles.new') })}
          rows={matrixRows(t, outsidePlan)}
          columns={matrixColumns(t)}
          value={draft.matrix}
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
      </Step>

      <Step n={4} title={t('roles.sensitive.title')}>
        <p className="m-0 border-b border-line px-[18px] py-2.5 text-[12.5px] text-ink-2">
          {t('roles.sensitive.subtitle')}
        </p>
        <SensitiveSwitches
          value={draft.sensitive}
          stored={[]}
          held={held}
          onChange={(key, on) => {
            setDraft(toggleSensitive(draft, key, on));
          }}
        />
      </Step>

      <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2.5 rounded-card border border-line bg-surface px-[18px] py-3 shadow-card">
        <Link href={usersHref('roles')} className={buttonVariants({ variant: 'secondary' })}>
          {t('common.cancel')}
        </Link>
        <Button type="submit" disabled={formState.isSubmitting}>
          {t('roles.form.create')}
        </Button>
      </div>
    </form>
  );
}
