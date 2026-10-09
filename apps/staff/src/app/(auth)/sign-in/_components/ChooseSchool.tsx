'use client';

import { Checkbox, cn } from '@quad/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from './AuthCard';
import { StepError } from './bits';
import { errorKeyFor } from './error-copy';

import type { SignInMembership } from '@quad/contracts';

import { ApiError, staffApi, unwrap, unwrapEmpty } from '@/lib/api';

export interface ChooseSchoolProps {
  email: string;
  onOpened: (school: string) => void;
  /** The chosen school asks for two-step first (403 `two_step_required`). */
  onTwoStepRequired: () => void;
}

/** The school's logo, or its short name on its own brand colour (inline CSS variables only). */
function SchoolMark({ school }: { school: SignInMembership }) {
  if (school.logoUrl !== null) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- school logos are uploaded files (M4)
      <img
        src={school.logoUrl}
        alt=""
        className="size-10 shrink-0 rounded-xl bg-surface object-contain p-1"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ '--school-fill': school.brand.fill, '--school-ink': school.brand.ink }}
      className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--school-fill) text-[13px] font-bold text-(--school-ink)"
    >
      {school.shortName}
    </span>
  );
}

/**
 * Step 4 with several schools (spec 05): logo, name and your role for each; a paused school is
 * listed with its reason and cannot be opened. "Remember my choice on this device" sets the
 * non-sensitive `quad_last_school` cookie; nothing is chosen for the person.
 */
export function ChooseSchool({ email, onOpened, onTwoStepRequired }: ChooseSchoolProps) {
  const { t } = useTranslation();
  const [remember, setRemember] = useState(true);
  const schools = useQuery({
    queryKey: ['auth', 'memberships'],
    queryFn: () => unwrap(staffApi().GET('/api/v1/auth/memberships')),
    retry: false,
  });
  const select = useMutation({
    mutationFn: (school: SignInMembership) =>
      unwrapEmpty(
        staffApi().POST('/api/v1/auth/select-school', {
          body: { tenantId: school.tenantId, remember },
        }),
      ),
    onSuccess: (_result, school) => {
      onOpened(school.name);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'two_step_required') onTwoStepRequired();
    },
  });

  const items = schools.data?.items ?? [];
  const failure = schools.isError ? schools.error : select.isError ? select.error : null;

  return (
    <AuthCard
      title={t('signIn.school.title')}
      lede={schools.isSuccess ? t('signIn.school.lede', { email, count: items.length }) : undefined}
    >
      {schools.isPending ? (
        <p className="m-0 text-[13px] text-ink-2" aria-live="polite">
          {t('signIn.school.loading')}
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((school) => (
          <li key={school.tenantId}>
            <button
              type="button"
              disabled={school.suspended || select.isPending}
              onClick={() => {
                select.mutate(school);
              }}
              className={cn(
                'grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-2.5 text-left text-ink',
                'hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line',
              )}
            >
              <SchoolMark school={school} />
              <span className="min-w-0">
                <span className="block truncate text-[14.5px] font-bold">{school.name}</span>
                <span className="block truncate text-[12.5px] text-ink-2">
                  {school.suspended
                    ? school.suspendReason === null
                      ? t('signIn.school.pausedNoReason')
                      : t('signIn.school.paused', { reason: school.suspendReason })
                    : school.roleNames.join(' · ')}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 text-ink-3" />
            </button>
          </li>
        ))}
      </ul>
      <Checkbox
        label={t('signIn.school.remember')}
        checked={remember}
        onCheckedChange={(checked) => {
          setRemember(checked === true);
        }}
      />
      <StepError>
        {failure !== null && !(failure instanceof ApiError && failure.code === 'two_step_required')
          ? t(errorKeyFor(failure))
          : null}
      </StepError>
    </AuthCard>
  );
}
