'use client';

import { useInfiniteQuery, useMutation } from '@tanstack/react-query';

import { consoleApi, unwrap } from '@/lib/api';

/** One page of the school list (spec 06 paging; the most the API gives at once). */
const SCHOOLS_PAGE = 200;

/** `GET /platform/tenants`: every school but deleted ones, by name, page by page. */
export function useSchools() {
  return useInfiniteQuery({
    queryKey: ['platform', 'tenants'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        consoleApi().GET('/api/v1/platform/tenants', {
          params: {
            query: {
              limit: SCHOOLS_PAGE,
              ...(pageParam === undefined ? {} : { cursor: pageParam }),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/**
 * `POST /platform/tenants/:id/support-session` with the reason (spec 05, D22): the single-use link
 * into the staff portal as the school's admin.
 */
export function useOpenSupportSession() {
  return useMutation({
    mutationFn: ({ tenantId, reason }: { tenantId: string; reason: string }) =>
      unwrap(
        consoleApi().POST('/api/v1/platform/tenants/{id}/support-session', {
          params: { path: { id: tenantId } },
          body: { reason },
        }),
      ),
  });
}
