'use client';

import { fieldError, isFieldError } from '@quad/client';
import { SupportSessionCreateInput, type PlatformTenant } from '@quad/contracts';
import { Button, Drawer, DrawerClose, Textarea, useToast } from '@quad/ui';
import { Eye, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useOpenSupportSession } from '@/components/data/use-schools';
import { messageFor } from '@/lib/error-copy';
import { openPage } from '@/lib/navigate';

export interface OpenAsSchoolAdminDrawerProps {
  /** The school chosen; the drawer keeps the last one while it closes. */
  school: PlatformTenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORM_ID = 'open-as-school-admin';

/**
 * "Open as school admin" (spec 05 → Support access; the prototype's impersonation flow). A reason
 * is always required (D22) and checked with the contract before anything is sent; the API then
 * records it and answers with a single-use link (2 minutes) into the staff portal, where the visit
 * lasts at most 60 minutes. The console then follows that link. The Drawer focuses the reason
 * itself (an `autoFocus` here would run first and become the element focus returns to).
 */
export function OpenAsSchoolAdminDrawer({
  school,
  open,
  onOpenChange,
}: OpenAsSchoolAdminDrawerProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const opening = useOpenSupportSession();
  const { reset } = opening;

  // A new school starts with an empty reason.
  useEffect(() => {
    setReason('');
    setProblem(null);
    reset();
  }, [school?.id, reset]);

  if (school === null) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (opening.isPending || opening.isSuccess) return;
    const parsed = SupportSessionCreateInput.safeParse({ reason });
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setProblem(null);
    opening.mutate(
      { tenantId: school.id, reason: parsed.data.reason },
      {
        onSuccess: ({ url }) => {
          toast.show(t('console.support.opening', { school: school.name }));
          openPage(url);
        },
        onError: (error) => {
          if (!isFieldError(error)) toast.show(messageFor(error, (key) => t(key)));
        },
      },
    );
  };

  const error = problem ?? fieldError(opening.error, 'reason');
  const label = t('console.support.submit', { school: school.name });

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={t('console.support.eyebrow')}
      title={t('console.support.title', { school: school.name })}
      icon={Eye}
      dirty={reason.trim() !== '' && !opening.isSuccess}
      footer={
        <>
          <DrawerClose asChild>
            <Button variant="secondary">{t('common.cancel')}</Button>
          </DrawerClose>
          <Button type="submit" form={FORM_ID} disabled={opening.isPending || opening.isSuccess}>
            {label}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p className="m-0 flex items-start gap-2 rounded-xl bg-info-soft px-3.5 py-2.5 text-[13px] text-ink">
          <ShieldCheck aria-hidden="true" strokeWidth={2} className="mt-px size-4 shrink-0" />
          {t('console.support.body', { school: school.name })}
        </p>
        <Textarea
          label={t('console.support.reason')}
          hint={t('console.support.reasonHint')}
          placeholder={t('console.support.reasonPlaceholder')}
          name="reason"
          rows={4}
          maxLength={1000}
          value={reason}
          error={error}
          onChange={(event) => {
            setReason(event.target.value);
            setProblem(null);
          }}
        />
      </form>
    </Drawer>
  );
}
