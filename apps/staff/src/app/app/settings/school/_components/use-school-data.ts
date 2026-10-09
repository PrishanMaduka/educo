'use client';

import { useToast } from '@quad/ui';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { AuditAction, School, SchoolUpdateInput } from '@quad/contracts';

import { ApiError, staffApi, unwrap } from '@/lib/api';

const SCHOOL = ['school'] as const;
const AUDIT = ['audit'] as const;

/** One page of the audit log (spec 06 paging). */
const AUDIT_PAGE = 50;

/** The Audit tab's filters, as `GET /audit` takes them. */
export interface AuditQuery {
  /** A member's id; null for everyone. */
  readonly actor: string | null;
  readonly action: AuditAction | null;
  /** A UTC instant; null for any time. */
  readonly from: string | null;
}

const queryOf = (filter: AuditQuery) => ({
  ...(filter.actor === null ? {} : { actor: filter.actor }),
  ...(filter.action === null ? {} : { action: filter.action }),
  ...(filter.from === null ? {} : { from: filter.from }),
});

/** `GET /school`: General, the read-only fields, the sign-in rules and the summary. */
export function useSchool() {
  return useQuery({
    queryKey: [...SCHOOL],
    queryFn: () => unwrap(staffApi().GET('/api/v1/school')),
  });
}

/**
 * `PATCH /school` with the version last read (`If-Match`, the body's `etag`, D32). The answer is
 * the school as saved, so the page shows it without reading again; the log gains an entry.
 */
export function useSaveSchool() {
  const { t } = useTranslation();
  const toast = useToast();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: ({ body, etag }: { body: SchoolUpdateInput; etag: string }) =>
      unwrap(
        staffApi().PATCH('/api/v1/school', {
          params: { header: { 'if-match': etag } },
          body,
        }),
      ),
    onSuccess: async (school: School) => {
      queries.setQueryData([...SCHOOL], school);
      toast.show(t('schoolSettings.toast.saved'));
      await queries.invalidateQueries({ queryKey: AUDIT });
    },
  });
}

/** `GET /audit`, newest first, page by page. */
export function useAuditLog(filter: AuditQuery, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...AUDIT, 'list', filter],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const page = await unwrap(
        staffApi().GET('/api/v1/audit', {
          params: {
            query: {
              limit: AUDIT_PAGE,
              ...queryOf(filter),
              ...(pageParam === undefined ? {} : { cursor: pageParam }),
            },
          },
        }),
      );
      // The route also answers CSV, so its type allows text; the page asks for JSON.
      if (typeof page === 'string') throw new ApiError('internal', 200, {}, 'Expected JSON');
      return page;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: (previous) => previous,
  });
}

/** `GET /audit/people`: the person filter's choices. */
export function useAuditPeople(enabled: boolean) {
  return useQuery({
    queryKey: [...AUDIT, 'people'],
    enabled,
    queryFn: () => unwrap(staffApi().GET('/api/v1/audit/people')),
  });
}

/**
 * `GET /audit` as CSV (needs `sensitive.export_data`): the filtered entries as a download. The
 * API audits the export, so the log is read again to show it.
 */
export function useExportAudit() {
  const { t } = useTranslation();
  const toast = useToast();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (filter: AuditQuery) => {
      const { data, error, response } = await staffApi().GET('/api/v1/audit', {
        params: { query: queryOf(filter) },
        headers: { accept: 'text/csv' },
        parseAs: 'blob',
      });
      if (!response.ok || data === undefined) {
        // The error body is JSON even when CSV was asked for.
        await unwrap(Promise.resolve({ error, response }));
      }
      return { blob: data, name: filenameOf(response) };
    },
    onSuccess: async ({ blob, name }) => {
      if (blob !== undefined) download(blob, name);
      toast.show(t('schoolSettings.audit.exported'));
      await queries.invalidateQueries({ queryKey: AUDIT });
    },
  });
}

/** The name the API gives the file (`quad-audit-2026-10-09.csv`). */
function filenameOf(response: Response): string {
  const header = response.headers.get('content-disposition') ?? '';
  return /filename="([^"]+)"/.exec(header)?.[1] ?? 'quad-audit.csv';
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
