'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Card, Input, Pill, SettingRow, Textarea, useLeaveGuard, useToast } from '@quad/ui';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  GENERAL_FIELDS,
  GeneralFormSchema,
  changesFrom,
  generalValuesOf,
  type GeneralFormInput,
  type GeneralFormOutput,
} from './general-form';
import { useSaveSchool, useSchool } from './use-school-data';

import type { School } from '@quad/contracts';

import { SaveBar } from '@/components/SaveBar';
import { ApiError } from '@/lib/api';
import { actionMessageFor } from '@/lib/error-copy';

export interface GeneralFormProps {
  school: School;
  canEdit: boolean;
  /** The office email field's id, which the page's "Add an office email" focuses. */
  officeEmailId: string;
  /** Told when the form gains or loses unsaved changes, so the page can hold its tabs. */
  onDirtyChange: (dirty: boolean) => void;
}

const FORM_ID = 'school-general';

const isGeneralField = (key: string): key is (typeof GENERAL_FIELDS)[number] =>
  GENERAL_FIELDS.some((field) => field === key);

/**
 * School settings → General (spec 08): the school's own details, saved in one `PATCH /school`
 * with the version last read; the time zone, logo and colour are Quad's. An inline settings form
 * with a save bar while there are changes, as in the prototype's profile page (D49); leaving with
 * unsaved changes asks first.
 */
export function GeneralForm({ school, canEdit, officeEmailId, onDirtyChange }: GeneralFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSaveSchool();
  const reread = useSchool();
  const form = useForm<GeneralFormInput, unknown, GeneralFormOutput>({
    resolver: zodResolver(GeneralFormSchema),
    defaultValues: generalValuesOf(school),
  });
  const { register, handleSubmit, reset, setError, formState } = form;
  const dirty = canEdit && formState.isDirty;
  useLeaveGuard(dirty, t('common.leaveUnsaved'));
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // A new version read from the API (another admin's save) becomes the starting point; fields
  // being changed here keep what was typed. Query data keeps its identity until it changes.
  useEffect(() => {
    reset(generalValuesOf(school), { keepDirtyValues: true });
  }, [school, reset]);

  const submit = handleSubmit(async (values) => {
    const body = changesFrom(values, school);
    if (Object.keys(body).length === 0) {
      reset(generalValuesOf(school));
      return;
    }
    try {
      const saved = await save.mutateAsync({ body, etag: school.etag });
      reset(generalValuesOf(saved));
    } catch (error) {
      const fields = error instanceof ApiError ? Object.entries(error.fields) : [];
      const named = fields.filter(([key]) => isGeneralField(key));
      for (const [key, message] of named) {
        if (isGeneralField(key)) setError(key, { message });
      }
      if (named.length === 0) toast.show(actionMessageFor(error, (key) => t(key)));
      // Someone else saved first (409): read their version; the changes typed here stay.
      if (error instanceof ApiError && error.status === 409) void reread.refetch();
    }
  });

  const errorOf = (field: keyof GeneralFormInput) => formState.errors[field]?.message;
  const fieldProps = { readOnly: !canEdit, autoComplete: 'off' };

  return (
    <form
      id={FORM_ID}
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex flex-col gap-5"
    >
      {canEdit ? null : (
        <p className="m-0 text-[13.5px] text-ink-2">{t('schoolSettings.general.viewOnly')}</p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t('schoolSettings.general.details')}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input
              label={t('schoolSettings.general.name')}
              error={errorOf('name')}
              fieldClassName="sm:col-span-2"
              {...fieldProps}
              autoComplete="organization"
              {...register('name')}
            />
            <Input
              id={officeEmailId}
              type="email"
              label={t('schoolSettings.general.officeEmail')}
              hint={t('schoolSettings.general.officeEmailHint')}
              error={errorOf('officeEmail')}
              {...fieldProps}
              {...register('officeEmail')}
            />
            <Input
              type="tel"
              label={t('schoolSettings.general.officePhone')}
              error={errorOf('officePhone')}
              {...fieldProps}
              {...register('officePhone')}
            />
            <Textarea
              label={t('schoolSettings.general.address')}
              error={errorOf('address')}
              rows={3}
              fieldClassName="sm:col-span-2"
              {...fieldProps}
              {...register('address')}
            />
          </div>
        </Card>
        <div className="flex min-w-0 flex-col gap-5">
          <Card title={t('schoolSettings.general.messages')}>
            <div className="flex flex-col gap-2">
              <Input
                label={t('schoolSettings.general.smsSenderId')}
                hint={t('schoolSettings.general.smsSenderHint')}
                error={errorOf('smsSenderId')}
                {...fieldProps}
                {...register('smsSenderId')}
              />
              {school.smsSenderStatus === null ? null : (
                <Pill
                  tone={school.smsSenderStatus === 'approved' ? 'good' : 'warn'}
                  className="self-start"
                >
                  {t(`schoolSettings.general.smsStatus.${school.smsSenderStatus}`)}
                </Pill>
              )}
            </div>
          </Card>
          <Card
            title={t('schoolSettings.general.setByQuad')}
            actions={
              <span className="text-[12.5px] text-ink-2">
                {t('schoolSettings.general.setByQuadHint')}
              </span>
            }
            flush
          >
            <dl className="m-0">
              <SettingRow label={t('schoolSettings.general.timeZone')}>
                {school.timeZone}
              </SettingRow>
              <SettingRow label={t('schoolSettings.general.logo')}>
                {school.branding.logoUrl === null ? (
                  t('schoolSettings.general.noLogo', { initials: school.shortName })
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- school logos are uploaded files (M4)
                  <img
                    src={school.branding.logoUrl}
                    alt=""
                    className="size-10 rounded-xl bg-surface object-contain p-1"
                  />
                )}
              </SettingRow>
              <SettingRow label={t('schoolSettings.general.colour')}>
                <span
                  aria-hidden="true"
                  style={{ '--swatch': school.branding.color }}
                  className="size-5 rounded-md border border-line bg-(--swatch)"
                />
                <span className="font-mono text-[13px] uppercase">{school.branding.color}</span>
              </SettingRow>
            </dl>
          </Card>
        </div>
      </div>
      {dirty ? (
        <SaveBar
          message={t('schoolSettings.general.unsaved')}
          discardLabel={t('schoolSettings.general.discard')}
          saveLabel={t('schoolSettings.general.save')}
          saving={formState.isSubmitting}
          form={FORM_ID}
          onDiscard={() => {
            reset(generalValuesOf(school));
          }}
        />
      ) : null}
    </form>
  );
}
