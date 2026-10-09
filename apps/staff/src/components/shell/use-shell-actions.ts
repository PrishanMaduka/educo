'use client';

import { useToast } from '@quad/ui';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { hrefOf } from './staff-nav';

import type { MessageKey } from '@/i18n';

import { ApiError, staffApi, unwrap, unwrapEmpty } from '@/lib/api';
import { messageFor } from '@/lib/error-copy';
import { openPage } from '@/lib/navigate';

/** Sign-in again, back to the portal, when the chosen school first needs two-step set up. */
const SIGN_IN_AGAIN = '/sign-in?next=%2Fapp';

export interface PreviewChoice {
  readonly roleId: string;
  /** A role scoped to its own classes (a teacher) previews one sample member's classes. */
  readonly needsSample: boolean;
  /** A preview is on: it is ended first, since a preview refuses every other write. */
  readonly previewing: boolean;
}

/** An active member who holds the role, as the preview's sample (the prototype's class teacher). */
async function sampleFor(roleId: string, noSample: string): Promise<string> {
  const staff = await unwrap(
    staffApi().GET('/api/v1/users', { params: { query: { roleId, status: 'active', limit: 1 } } }),
  );
  const sample = staff.items[0];
  if (sample === undefined) {
    throw new ApiError('validation', 400, { sampleUserId: noSample }, noSample);
  }
  return sample.id;
}

/**
 * The shell's session changes (spec 05, spec 08), each a write with the CSRF header, then a full
 * page load so the layout reads the new session. A failure shows a toast in the person's words.
 */
export function useShellActions() {
  const { t } = useTranslation();
  const toast = useToast();
  const fail = (error: unknown) => {
    toast.show(messageFor(error, (key: MessageKey) => t(key)));
  };

  const signOut = useMutation({
    mutationFn: () => unwrapEmpty(staffApi().POST('/api/v1/auth/sign-out')),
    onSuccess: () => {
      openPage('/sign-in');
    },
    onError: (error) => {
      // Already signed out (an expired session): sign-in is where they were going anyway.
      if (error instanceof ApiError && error.status === 401) openPage('/sign-in');
      else fail(error);
    },
  });

  const switchSchool = useMutation({
    mutationFn: (tenantId: string) =>
      unwrapEmpty(
        staffApi().POST('/api/v1/auth/select-school', { body: { tenantId, remember: false } }),
      ),
    onSuccess: () => {
      openPage('/app');
    },
    onError: (error) => {
      // The API moved the session to two-step set-up for that school (spec 05): finish it there.
      if (error instanceof ApiError && error.code === 'two_step_required') openPage(SIGN_IN_AGAIN);
      else fail(error);
    },
  });

  const backToMyView = useMutation({
    mutationFn: () => unwrapEmpty(staffApi().DELETE('/api/v1/me/role-preview')),
    onSuccess: () => {
      openPage('/app');
    },
    onError: fail,
  });

  const startPreview = useMutation({
    mutationFn: async ({ roleId, needsSample, previewing }: PreviewChoice) => {
      if (previewing) await unwrapEmpty(staffApi().DELETE('/api/v1/me/role-preview'));
      const sampleUserId = needsSample
        ? await sampleFor(roleId, t('error.previewNeedsSample'))
        : undefined;
      return unwrap(
        staffApi().POST('/api/v1/me/role-preview', {
          body: sampleUserId === undefined ? { roleId } : { roleId, sampleUserId },
        }),
      );
    },
    // The portal re-opens on the previewed role's home page (spec 08).
    onSuccess: (permissions) => {
      openPage(hrefOf(permissions.home));
    },
    onError: fail,
  });

  const exitSupport = useMutation({
    mutationFn: () => unwrap(staffApi().POST('/api/v1/auth/support-session/end')),
    onSuccess: (exit) => {
      openPage(exit.redirect);
    },
    onError: fail,
  });

  return { signOut, switchSchool, backToMyView, startPreview, exitSupport };
}

export type ShellActions = ReturnType<typeof useShellActions>;
