'use client';

import { filenameFrom } from '@quad/client';
import { downloadBlob, useToast } from '@quad/ui';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { PlatformAuditLogAction } from '@quad/contracts';

import { ApiError, consoleApi, unwrap, unwrapEmpty } from '@/lib/api';

const AUDIT = ['platform', 'audit'] as const;

/** One page of the log (spec 06 paging). */
const AUDIT_PAGE = 50;

/** The Audit log's filters, as `GET /platform/audit` takes them; null is "any". */
export interface PlatformAuditQuery {
  readonly actor: string | null;
  readonly tenantId: string | null;
  readonly action: PlatformAuditLogAction | null;
  /** A UTC instant. */
  readonly from: string | null;
}

const queryOf = (filter: PlatformAuditQuery) => ({
  ...(filter.actor === null ? {} : { actor: filter.actor }),
  ...(filter.tenantId === null ? {} : { tenantId: filter.tenantId }),
  ...(filter.action === null ? {} : { action: filter.action }),
  ...(filter.from === null ? {} : { from: filter.from }),
});

/** `GET /platform/audit`, newest first, page by page. */
export function usePlatformAuditLog(filter: PlatformAuditQuery) {
  return useInfiniteQuery({
    queryKey: [...AUDIT, 'list', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const page = await unwrap(
        consoleApi().GET('/api/v1/platform/audit', {
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

/** `GET /platform/audit/people`: the Quad staff filter's choices (D50). */
export function usePlatformAuditPeople() {
  return useQuery({
    queryKey: [...AUDIT, 'people'],
    queryFn: () => unwrap(consoleApi().GET('/api/v1/platform/audit/people')),
  });
}

/**
 * `GET /platform/audit` as CSV: the filtered entries as a download. The API records the export,
 * so the log is read again to show it.
 */
export function useExportPlatformAudit() {
  const { t } = useTranslation();
  const toast = useToast();
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (filter: PlatformAuditQuery) => {
      const { data, error, response } = await consoleApi().GET('/api/v1/platform/audit', {
        params: { query: queryOf(filter) },
        headers: { accept: 'text/csv' },
        parseAs: 'blob',
      });
      // A refusal's body is JSON even when CSV was asked for.
      await unwrapEmpty(Promise.resolve({ error, response }));
      // An export always has its heading row, so no file at all is a failure, never a success.
      if (data === undefined || data.size === 0) {
        throw new ApiError('internal', response.status, {}, 'The export had no file');
      }
      return { blob: data, name: filenameFrom(response, 'quad-platform-audit.csv') };
    },
    onSuccess: async ({ blob, name }) => {
      downloadBlob(blob, name);
      toast.show(t('console.audit.exported'));
      await queries.invalidateQueries({ queryKey: AUDIT });
    },
  });
}
